import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SubjectPill } from '@/components/SubjectPill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as subjectsDb from '@/lib/db/subjects';
import { useSettingsStore } from '@/store/settingsStore';
import { useTimerStore } from '@/store/timerStore';
import type { Subject } from '@/types';

type Mode = 'pomodoro' | 'focus';

export default function FocusScreen() {
  const theme = useTheme();
  const router = useRouter();

  const prefs = useSettingsStore();
  const updatePrefs = useSettingsStore((s) => s.update);

  const timerStatus = useTimerStore((s) => s.status);
  const startPomodoro = useTimerStore((s) => s.startPomodoro);
  const startFocus = useTimerStore((s) => s.startFocus);

  const [mode, setMode] = useState<Mode>('pomodoro');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useFocusEffect(
    useCallback(() => {
      subjectsDb.listSubjects().then(setSubjects);
    }, []),
  );

  const start = () => {
    if (mode === 'pomodoro') startPomodoro(subjectId);
    else startFocus(subjectId);
    router.push('/focus-session');
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">Fokus</ThemedText>

          {timerStatus !== 'idle' && (
            <Button title="▶ Fortsæt igangværende session" onPress={() => router.push('/focus-session')} />
          )}

          {/* Mode-vælger */}
          <View style={styles.segment}>
            {(['pomodoro', 'focus'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[
                  styles.segmentItem,
                  {
                    backgroundColor: mode === m ? theme.accent : theme.backgroundElement,
                  },
                ]}>
                <ThemedText
                  style={{ color: mode === m ? '#fff' : theme.text, fontWeight: '700' }}>
                  {m === 'pomodoro' ? 'Pomodoro' : 'Fokus (stopur)'}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {mode === 'pomodoro' && (
            <Card>
              <Stepper
                label="Arbejde"
                value={prefs.workMin}
                unit="min"
                onChange={(v) => updatePrefs({ workMin: v })}
                min={5}
                max={90}
                step={5}
              />
              <Stepper
                label="Pause"
                value={prefs.breakMin}
                unit="min"
                onChange={(v) => updatePrefs({ breakMin: v })}
                min={1}
                max={30}
                step={1}
              />
              <Stepper
                label="Lang pause"
                value={prefs.longBreakMin}
                unit="min"
                onChange={(v) => updatePrefs({ longBreakMin: v })}
                min={5}
                max={45}
                step={5}
              />
              <Stepper
                label="Runder før lang pause"
                value={prefs.cyclesBeforeLongBreak}
                unit=""
                onChange={(v) => updatePrefs({ cyclesBeforeLongBreak: v })}
                min={2}
                max={8}
                step={1}
              />
            </Card>
          )}

          {/* Fag-link */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Knyt til fag (valgfrit)
            </ThemedText>
            {subjects.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Ingen fag endnu — opret en deadline med et fag først.
              </ThemedText>
            ) : (
              <View style={styles.chips}>
                {subjects.map((s) => {
                  const selected = subjectId === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSubjectId(selected ? null : s.id)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? s.color : theme.border,
                          backgroundColor: selected ? s.color + '22' : 'transparent',
                        },
                      ]}>
                      <SubjectPill name={s.name} color={s.color} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <Button title={mode === 'pomodoro' ? 'Start Pomodoro' : 'Start fokus'} onPress={start} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Stepper({
  label,
  value,
  unit,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  const theme = useTheme();
  const btn = (text: string, delta: number) => (
    <Pressable
      onPress={() => onChange(Math.max(min, Math.min(max, value + delta)))}
      style={[styles.stepBtn, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.stepBtnText}>{text}</ThemedText>
    </Pressable>
  );
  return (
    <View style={styles.stepperRow}>
      <ThemedText style={styles.flex}>{label}</ThemedText>
      {btn('−', -step)}
      <ThemedText style={styles.stepValue}>
        {value}
        {unit ? ` ${unit}` : ''}
      </ThemedText>
      {btn('＋', step)}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  segment: { flexDirection: 'row', gap: Spacing.two },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
  },
  section: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    padding: Spacing.one,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, fontWeight: '700' },
  stepValue: { minWidth: 64, textAlign: 'center', fontWeight: '700' },
});
