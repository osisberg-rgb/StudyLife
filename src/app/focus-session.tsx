import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as subjectsDb from '@/lib/db/subjects';
import { useTimerStore } from '@/store/timerStore';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function clock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function FocusSessionScreen() {
  const theme = useTheme();
  const router = useRouter();

  const mode = useTimerStore((s) => s.mode);
  const status = useTimerStore((s) => s.status);
  const phase = useTimerStore((s) => s.phase);
  const remainingSec = useTimerStore((s) => s.remainingSec);
  const elapsedSec = useTimerStore((s) => s.elapsedSec);
  const pomodorosCompleted = useTimerStore((s) => s.pomodorosCompleted);
  const subjectId = useTimerStore((s) => s.subjectId);

  const tick = useTimerStore((s) => s.tick);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip = useTimerStore((s) => s.skip);
  const stop = useTimerStore((s) => s.stop);

  const [subjectName, setSubjectName] = useState<string | null>(null);

  // 1-sekunds ticker der opdaterer visningen og udløser fase-skift.
  useEffect(() => {
    tick();
    const id = setInterval(() => tick(), 1000);
    return () => clearInterval(id);
  }, [tick]);

  // Hvis ingen session kører (fx hot reload), gå tilbage.
  useEffect(() => {
    if (mode === null) router.back();
  }, [mode, router]);

  useEffect(() => {
    let active = true;
    (async () => {
      const s = subjectId ? await subjectsDb.getSubject(subjectId) : null;
      if (active) setSubjectName(s?.name ?? null);
    })();
    return () => {
      active = false;
    };
  }, [subjectId]);

  if (mode === null) return <ThemedView style={styles.flex} />;

  const isPomodoro = mode === 'pomodoro';
  const isBreak = isPomodoro && phase === 'break';
  const display = isPomodoro ? remainingSec : elapsedSec;

  const phaseLabel = !isPomodoro ? 'Fokus' : isBreak ? 'Pause' : 'Arbejde';
  const accent = isBreak ? theme.success : theme.accent;

  const handleStop = () => {
    stop();
    router.back();
  };

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.top}>
          <ThemedText type="smallBold" style={{ color: accent }}>
            {phaseLabel.toUpperCase()}
          </ThemedText>
          {subjectName && (
            <ThemedText type="small" themeColor="textSecondary">
              {subjectName}
            </ThemedText>
          )}
        </View>

        <View style={styles.center}>
          <ThemedText style={[styles.clock, { color: accent }]}>{clock(display)}</ThemedText>
          {isPomodoro && (
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>
              {pomodorosCompleted} runde{pomodorosCompleted === 1 ? '' : 'r'} fuldført
            </ThemedText>
          )}
          {status === 'paused' && (
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: Spacing.one }}>
              Sat på pause
            </ThemedText>
          )}
        </View>

        <View style={styles.controls}>
          <View style={styles.controlRow}>
            {status === 'running' ? (
              <Button title="Pause" variant="secondary" style={styles.flex} onPress={() => pause()} />
            ) : (
              <Button title="Genoptag" style={styles.flex} onPress={() => resume()} />
            )}
            {isPomodoro && (
              <Pressable
                onPress={() => skip()}
                style={[styles.skipBtn, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.skipText}>Spring fase over ⏭</ThemedText>
              </Pressable>
            )}
          </View>
          <Button title="Stop og gem" variant="danger" onPress={handleStop} />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: {
    alignItems: 'center',
    paddingTop: Spacing.four,
    gap: Spacing.one,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clock: {
    fontSize: 88,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  controlRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  skipBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    minHeight: 52,
    justifyContent: 'center',
  },
  skipText: { fontWeight: '600' },
});
