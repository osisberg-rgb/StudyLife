import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { SubjectColors } from '@/constants/subjectColors';
import { useTheme } from '@/hooks/use-theme';
import { getApiKey } from '@/lib/ai';
import * as subjectsDb from '@/lib/db/subjects';
import { rescheduleAllDeadlines } from '@/lib/notifications';
import { useSettingsStore } from '@/store/settingsStore';
import type { Subject } from '@/types';

const LEAD_OPTIONS = [
  { days: 7, label: '7 dage før' },
  { days: 3, label: '3 dage før' },
  { days: 1, label: '1 dag før' },
  { days: 0, label: 'På dagen' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const notifLeadDays = useSettingsStore((s) => s.notifLeadDays);
  const updatePrefs = useSettingsStore((s) => s.update);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const apiKeySet = getApiKey() !== null;

  const reloadSubjects = useCallback(async () => {
    setSubjects(await subjectsDb.listSubjects());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadSubjects();
    }, [reloadSubjects]),
  );

  const toggleLead = async (day: number) => {
    const set = new Set(notifLeadDays);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    const next = [...set].sort((a, b) => b - a);
    await updatePrefs({ notifLeadDays: next });
    await rescheduleAllDeadlines(next);
  };

  const cycleColor = async (s: Subject) => {
    const idx = SubjectColors.indexOf(s.color as (typeof SubjectColors)[number]);
    const nextColor = SubjectColors[(idx + 1) % SubjectColors.length];
    await subjectsDb.updateSubject(s.id, s.name, nextColor);
    reloadSubjects();
  };

  const renameSubject = (s: Subject) => {
    Alert.prompt(
      'Omdøb fag',
      undefined,
      async (text) => {
        if (text && text.trim()) {
          await subjectsDb.updateSubject(s.id, text.trim(), s.color);
          reloadSubjects();
        }
      },
      'plain-text',
      s.name,
    );
  };

  const deleteSubject = (s: Subject) => {
    Alert.alert('Slet fag', `Slet "${s.name}"? Deadlines beholdes, men mister deres fag.`, [
      { text: 'Annullér', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          await subjectsDb.deleteSubject(s.id);
          reloadSubjects();
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['bottom']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Påmindelser */}
          <View style={styles.section}>
            <ThemedText type="smallBold">Påmindelser</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Hvornår vil du mindes om en deadline? Ændringer gælder også eksisterende deadlines.
            </ThemedText>
            <View style={styles.chips}>
              {LEAD_OPTIONS.map((opt) => {
                const active = notifLeadDays.includes(opt.days);
                return (
                  <Pressable
                    key={opt.days}
                    onPress={() => toggleLead(opt.days)}
                    style={[
                      styles.leadChip,
                      {
                        backgroundColor: active ? theme.accent : theme.backgroundElement,
                      },
                    ]}>
                    <ThemedText
                      type="small"
                      style={{ color: active ? '#fff' : theme.text, fontWeight: '700' }}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {notifLeadDays.length === 0 && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                Ingen påmindelser slået til.
              </ThemedText>
            )}
          </View>

          {/* Fag */}
          <View style={styles.section}>
            <ThemedText type="smallBold">Fag</ThemedText>
            {subjects.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Ingen fag endnu. Fag oprettes automatisk når du tilføjer en deadline med et fag.
              </ThemedText>
            ) : (
              <Card>
                {subjects.map((s, i) => (
                  <View
                    key={s.id}
                    style={[
                      styles.subjectRow,
                      i < subjects.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.border,
                      },
                    ]}>
                    <Pressable onPress={() => cycleColor(s)} hitSlop={8}>
                      <View style={[styles.swatch, { backgroundColor: s.color }]} />
                    </Pressable>
                    <ThemedText style={styles.flex} numberOfLines={1}>
                      {s.name}
                    </ThemedText>
                    <Pressable onPress={() => renameSubject(s)} hitSlop={8}>
                      <ThemedText style={{ color: theme.accent, fontWeight: '600' }}>Omdøb</ThemedText>
                    </Pressable>
                    <Pressable onPress={() => deleteSubject(s)} hitSlop={8}>
                      <ThemedText style={{ color: theme.danger, fontSize: 18 }}>✕</ThemedText>
                    </Pressable>
                  </View>
                ))}
              </Card>
            )}
            <ThemedText type="small" themeColor="textSecondary">
              Tryk på farveprikken for at skifte farve.
            </ThemedText>
          </View>

          {/* AI */}
          <View style={styles.section}>
            <ThemedText type="smallBold">AI-import</ThemedText>
            <Card>
              <View style={styles.spread}>
                <ThemedText>API-nøgle</ThemedText>
                <ThemedText
                  type="smallBold"
                  style={{ color: apiKeySet ? theme.success : theme.danger }}>
                  {apiKeySet ? 'Sat ✓' : 'Mangler'}
                </ThemedText>
              </View>
              {!apiKeySet && (
                <ThemedText type="small" themeColor="textSecondary">
                  Sæt EXPO_PUBLIC_ANTHROPIC_API_KEY i din .env-fil og genstart appen.
                </ThemedText>
              )}
            </Card>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  leadChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  swatch: { width: 22, height: 22, borderRadius: 11 },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
