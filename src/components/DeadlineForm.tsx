import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { SubjectPill } from '@/components/SubjectPill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as deadlinesDb from '@/lib/db/deadlines';
import * as subjectsDb from '@/lib/db/subjects';
import { DEFAULT_DUE_HOUR, epochToIsoDate, formatFullDate } from '@/lib/dates';
import { cancelDeadlineNotifications, scheduleDeadlineNotifications } from '@/lib/notifications';
import { useSettingsStore } from '@/store/settingsStore';
import type { Deadline, Subject } from '@/types';

/** Kombinér 'YYYY-MM-DD' + 'HH:MM' til epoch-ms (lokal). Null ved ugyldigt input. */
function combineDateTime(dateStr: string, timeStr: string): number | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!dm || !tm) return null;
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [hh, mm] = [Number(tm[1]), Number(tm[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  const date = new Date(y, mo - 1, d, hh, mm, 0, 0);
  if (date.getMonth() !== mo - 1) return null; // fanger fx 31. feb
  return date.getTime();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function DeadlineForm({ deadlineId }: { deadlineId?: string }) {
  const theme = useTheme();
  const router = useRouter();
  const leadDays = useSettingsStore((s) => s.notifLeadDays);

  const editing = Boolean(deadlineId);
  const [existing, setExisting] = useState<Deadline | null>(null);
  const [completed, setCompleted] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [description, setDescription] = useState('');
  // Lazy initializer: Date.now() køres kun ved første render, ikke ved hver.
  const [dateStr, setDateStr] = useState(() => epochToIsoDate(Date.now()));
  const [timeStr, setTimeStr] = useState(`${pad(DEFAULT_DUE_HOUR)}:00`);

  useEffect(() => {
    (async () => {
      setSubjects(await subjectsDb.listSubjects());
      if (deadlineId) {
        const d = await deadlinesDb.getDeadline(deadlineId);
        if (d) {
          setExisting(d);
          setCompleted(d.completed);
          setTitle(d.title);
          setSubjectName(d.subjectName ?? '');
          setDescription(d.description ?? '');
          setDateStr(epochToIsoDate(d.dueDate));
          const due = new Date(d.dueDate);
          setTimeStr(`${pad(due.getHours())}:${pad(due.getMinutes())}`);
        }
      }
    })();
  }, [deadlineId]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Mangler titel', 'Giv din deadline en titel.');
      return;
    }
    const dueDate = combineDateTime(dateStr, timeStr);
    if (dueDate === null) {
      Alert.alert('Ugyldig dato/tid', 'Brug formatet ÅÅÅÅ-MM-DD og TT:MM.');
      return;
    }
    setSaving(true);
    try {
      const subjectId = subjectName.trim()
        ? (await subjectsDb.getOrCreateSubjectByName(subjectName)).id
        : null;
      const desc = description.trim() || null;

      let deadline: Deadline;
      if (editing && existing) {
        await deadlinesDb.updateDeadline(existing.id, {
          subjectId,
          title,
          description: desc,
          dueDate,
        });
        deadline = { ...existing, subjectId, title: title.trim(), description: desc, dueDate };
      } else {
        deadline = await deadlinesDb.createDeadline({
          subjectId,
          title,
          description: desc,
          dueDate,
          source: 'manual',
        });
      }

      await scheduleDeadlineNotifications(deadline, leadDays);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Slet deadline', `Slet "${existing.title}"?`, [
      { text: 'Annullér', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          await cancelDeadlineNotifications(existing.id);
          await deadlinesDb.deleteDeadline(existing.id);
          router.back();
        },
      },
    ]);
  };

  const toggleComplete = async () => {
    if (!existing) return;
    const next = !completed;
    await deadlinesDb.setDeadlineCompleted(existing.id, next);
    const updated: Deadline = { ...existing, completed: next };
    setExisting(updated);
    setCompleted(next);
    if (next) await cancelDeadlineNotifications(existing.id);
    else await scheduleDeadlineNotifications(updated, leadDays);
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['bottom']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field label="Titel" value={title} onChangeText={setTitle} placeholder="fx Aflevering 3" />

          <Field
            label="Fag (valgfrit)"
            value={subjectName}
            onChangeText={setSubjectName}
            placeholder="fx Statistik"
          />
          {subjects.length > 0 && (
            <View style={styles.chips}>
              {subjects.map((s) => (
                <Pressable key={s.id} onPress={() => setSubjectName(s.name)}>
                  <SubjectPill name={s.name} color={s.color} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.row}>
            <View style={styles.flex}>
              <Field
                label="Dato"
                value={dateStr}
                onChangeText={setDateStr}
                placeholder="ÅÅÅÅ-MM-DD"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.timeField}>
              <Field
                label="Tid"
                value={timeStr}
                onChangeText={setTimeStr}
                placeholder="TT:MM"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <Field
            label="Noter (valgfrit)"
            value={description}
            onChangeText={setDescription}
            placeholder="Detaljer…"
            multiline
            style={styles.multiline}
          />

          {editing && (
            <Button
              title={completed ? 'Markér som aktiv' : 'Markér som fuldført'}
              variant="secondary"
              onPress={toggleComplete}
            />
          )}
          <Button title={editing ? 'Gem ændringer' : 'Tilføj deadline'} onPress={save} loading={saving} />
          {editing && existing && (
            <>
              <Pressable onPress={remove} style={styles.deleteBtn}>
                <ThemedText style={{ color: theme.danger, fontWeight: '600' }}>Slet deadline</ThemedText>
              </Pressable>
              <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
                {existing.source === 'ai' ? 'Importeret med AI' : 'Tilføjet manuelt'} · oprettet{' '}
                {formatFullDate(existing.createdAt)}
              </ThemedText>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.three },
  timeField: { width: 120 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  deleteBtn: { alignItems: 'center', paddingVertical: Spacing.three },
  metaText: { textAlign: 'center' },
});
