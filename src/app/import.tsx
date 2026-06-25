import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AnthropicError, extractPlan, getApiKey, type PickedFile } from '@/lib/ai';
import * as deadlinesDb from '@/lib/db/deadlines';
import * as subjectsDb from '@/lib/db/subjects';
import { isoDateToEpoch } from '@/lib/dates';
import { scheduleDeadlineNotifications } from '@/lib/notifications';
import { useSettingsStore } from '@/store/settingsStore';

type Phase = 'pick' | 'extracting' | 'review' | 'error';

// Redigerbar række i review-skærmen (lokal id til React-keys).
type ReviewItem = {
  key: string;
  title: string;
  subject: string;
  dateStr: string; // 'YYYY-MM-DD' eller '' hvis AI var usikker
};

let keySeq = 0;

export default function ImportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const leadDays = useSettingsStore((s) => s.notifLeadDays);

  const [phase, setPhase] = useState<Phase>('pick');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [rawError, setRawError] = useState<{ raw: string; error: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Adgang nægtet', 'Giv adgang til billeder i Indstillinger for at importere.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setFile({ uri: a.uri, kind: 'image', mimeType: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'billede' });
  };

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setFile({ uri: a.uri, kind: 'pdf', mimeType: a.mimeType ?? 'application/pdf', name: a.name });
  };

  const runExtraction = async () => {
    if (!file) return;
    if (!getApiKey()) {
      Alert.alert(
        'Mangler API-nøgle',
        'Sæt EXPO_PUBLIC_ANTHROPIC_API_KEY i din .env-fil og genstart appen.',
      );
      return;
    }
    setPhase('extracting');
    try {
      const result = await extractPlan(file);
      if (result.ok) {
        setItems(
          result.deadlines.map((d) => ({
            key: `r${keySeq++}`,
            title: d.title,
            subject: d.subject ?? '',
            dateStr: d.dueDate ?? '',
          })),
        );
        setPhase('review');
      } else {
        setRawError({ raw: result.raw, error: result.error });
        setPhase('error');
      }
    } catch (e) {
      const msg = e instanceof AnthropicError ? e.message : e instanceof Error ? e.message : String(e);
      setRawError({ raw: '', error: msg });
      setPhase('error');
    }
  };

  const updateItem = (key: string, patch: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const save = async () => {
    setSaving(true);
    try {
      let saved = 0;
      let skipped = 0;
      for (const it of items) {
        const due = isoDateToEpoch(it.dateStr);
        if (!it.title.trim() || due === null) {
          skipped++;
          continue;
        }
        const subjectId = it.subject.trim()
          ? (await subjectsDb.getOrCreateSubjectByName(it.subject)).id
          : null;
        const deadline = await deadlinesDb.createDeadline({
          subjectId,
          title: it.title,
          description: null,
          dueDate: due,
          source: 'ai',
        });
        await scheduleDeadlineNotifications(deadline, leadDays);
        saved++;
      }
      const msg = skipped > 0 ? `${saved} gemt, ${skipped} sprunget over (manglede dato).` : `${saved} deadlines gemt.`;
      Alert.alert('Importeret', msg, [{ text: 'OK', onPress: () => router.back() }]);
    } finally {
      setSaving(false);
    }
  };

  // ---- Render pr. fase ----

  if (phase === 'extracting') {
    return (
      <ThemedView style={[styles.flex, styles.center]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText style={{ marginTop: Spacing.three }}>Læser plan med AI…</ThemedText>
      </ThemedView>
    );
  }

  if (phase === 'error' && rawError) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView edges={['bottom']} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content}>
            <ThemedText type="subtitle">Kunne ikke læse svaret</ThemedText>
            <ThemedText themeColor="textSecondary">{rawError.error}</ThemedText>
            {rawError.raw.length > 0 && (
              <Card>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Rå-svar fra AI
                </ThemedText>
                <ThemedText type="small" style={styles.mono}>
                  {rawError.raw}
                </ThemedText>
              </Card>
            )}
            <Button title="Prøv igen" onPress={() => setPhase('pick')} />
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (phase === 'review') {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView edges={['bottom']} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">Tjek datoer</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              AI’en er ikke altid 100%. Ret eventuelle fejl før du gemmer. Rækker uden gyldig dato
              gemmes ikke.
            </ThemedText>

            {items.length === 0 && (
              <ThemedText themeColor="textSecondary">Ingen datoer fundet i dokumentet.</ThemedText>
            )}

            {items.map((it) => {
              const dateValid = it.dateStr.trim() === '' ? false : isoDateToEpoch(it.dateStr) !== null;
              return (
                <Card key={it.key}>
                  <View style={styles.itemHeader}>
                    <TextInput
                      value={it.title}
                      onChangeText={(t) => updateItem(it.key, { title: t })}
                      placeholder="Titel"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.titleInput, { color: theme.text }]}
                    />
                    <Pressable hitSlop={8} onPress={() => removeItem(it.key)}>
                      <ThemedText style={{ color: theme.danger, fontSize: 18 }}>✕</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.itemRow}>
                    <TextInput
                      value={it.subject}
                      onChangeText={(t) => updateItem(it.key, { subject: t })}
                      placeholder="Fag (valgfrit)"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.subInput, { color: theme.text, borderColor: theme.border }]}
                    />
                    <TextInput
                      value={it.dateStr}
                      onChangeText={(t) => updateItem(it.key, { dateStr: t })}
                      placeholder="ÅÅÅÅ-MM-DD"
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="none"
                      keyboardType="numbers-and-punctuation"
                      style={[
                        styles.dateInput,
                        { color: theme.text, borderColor: dateValid ? theme.border : theme.danger },
                      ]}
                    />
                  </View>
                  {!dateValid && (
                    <ThemedText type="small" style={{ color: theme.danger }}>
                      Mangler gyldig dato (ÅÅÅÅ-MM-DD)
                    </ThemedText>
                  )}
                </Card>
              );
            })}

            {items.length > 0 && (
              <Button title="Gem deadlines" onPress={save} loading={saving} />
            )}
            <Button title="Vælg en anden fil" variant="secondary" onPress={() => setPhase('pick')} />
          </ScrollView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // phase === 'pick'
  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['bottom']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">Importér plan</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Vælg et billede eller en PDF af din semesterplan eller pensum. AI’en finder
            afleveringer og vigtige datoer, som du kan rette igennem inden de gemmes.
          </ThemedText>

          <View style={styles.pickRow}>
            <Button title="📷 Billede" variant="secondary" style={styles.flex} onPress={pickImage} />
            <Button title="📄 PDF" variant="secondary" style={styles.flex} onPress={pickPdf} />
          </View>

          {file && (
            <Card>
              <ThemedText type="smallBold">Valgt fil</ThemedText>
              <ThemedText numberOfLines={1}>{file.name ?? file.uri}</ThemedText>
            </Card>
          )}

          <Button title="Udtræk deadlines" onPress={runExtraction} disabled={!file} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  pickRow: { flexDirection: 'row', gap: Spacing.three },
  mono: { fontFamily: 'ui-monospace' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  titleInput: { flex: 1, fontSize: 16, fontWeight: '600' },
  itemRow: { flexDirection: 'row', gap: Spacing.two },
  subInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  dateInput: {
    width: 130,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
});
