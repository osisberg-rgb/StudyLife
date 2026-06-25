import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { ProgressBar } from '@/components/ProgressBar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as goalsDb from '@/lib/db/goals';
import { formatMinutes } from '@/lib/dates';
import { loadStatsOverview, type StatsOverview } from '@/lib/stats';

export default function StatsScreen() {
  const theme = useTheme();
  const [data, setData] = useState<StatsOverview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    setData(await loadStatsOverview());
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const setGoal = async (period: 'daily' | 'weekly', value: number) => {
    await goalsDb.setGoalTarget(period, value);
    reload();
  };

  if (!data) {
    return (
      <ThemedView style={styles.flex}>
        <SafeAreaView edges={['top']} style={styles.flex} />
      </ThemedView>
    );
  }

  const maxMin = Math.max(...data.last7Days.map((d) => d.minutes), 1);
  const maxSubjectSec = Math.max(...data.perSubjectWeek.map((s) => s.totalSec), 1);

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }>
          <ThemedText type="subtitle">Statistik</ThemedText>

          {/* Streak + dagens/ugens mål */}
          <Card>
            <View style={styles.spread}>
              <ThemedText type="smallBold">🔥 Streak</ThemedText>
              <ThemedText type="smallBold">{data.streak} dage</ThemedText>
            </View>
          </Card>

          <Card>
            <View style={styles.spread}>
              <ThemedText type="smallBold">Dagligt mål</ThemedText>
              <GoalStepper value={data.dailyGoalMin} onChange={(v) => setGoal('daily', v)} step={15} min={15} max={600} />
            </View>
            <ProgressBar progress={data.dailyGoalMin > 0 ? data.todayMin / data.dailyGoalMin : 0} />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMinutes(data.todayMin)} af {formatMinutes(data.dailyGoalMin)} i dag
            </ThemedText>
          </Card>

          <Card>
            <View style={styles.spread}>
              <ThemedText type="smallBold">Ugentligt mål</ThemedText>
              <GoalStepper value={data.weeklyGoalMin} onChange={(v) => setGoal('weekly', v)} step={60} min={60} max={3000} />
            </View>
            <ProgressBar
              progress={data.weeklyGoalMin > 0 ? data.weekMin / data.weeklyGoalMin : 0}
              color={theme.success}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {formatMinutes(data.weekMin)} af {formatMinutes(data.weeklyGoalMin)} denne uge
            </ThemedText>
          </Card>

          {/* Søjlediagram sidste 7 dage */}
          <View style={styles.section}>
            <ThemedText type="smallBold">Sidste 7 dage</ThemedText>
            <Card>
              <View style={styles.chart}>
                {data.last7Days.map((d) => (
                  <View key={d.dayKey} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${(d.minutes / maxMin) * 100}%`,
                            backgroundColor: d.minutes > 0 ? theme.accent : theme.backgroundSelected,
                          },
                        ]}
                      />
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {d.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Card>
          </View>

          {/* Tid pr. fag */}
          <View style={styles.section}>
            <ThemedText type="smallBold">Tid pr. fag (denne uge)</ThemedText>
            {data.perSubjectWeek.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Ingen sessioner registreret endnu.
              </ThemedText>
            ) : (
              <Card>
                {data.perSubjectWeek.map((s, i) => (
                  <View key={s.subjectId ?? `none-${i}`} style={styles.subjectRow}>
                    <View style={styles.spread}>
                      <ThemedText type="small">{s.subjectName ?? 'Uden fag'}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatMinutes(Math.round(s.totalSec / 60))}
                      </ThemedText>
                    </View>
                    <ProgressBar
                      progress={s.totalSec / maxSubjectSec}
                      color={s.subjectColor ?? theme.textSecondary}
                    />
                  </View>
                ))}
              </Card>
            )}
          </View>

          <Card>
            <View style={styles.spread}>
              <ThemedText type="smallBold">Sessioner denne uge</ThemedText>
              <ThemedText type="smallBold">{data.sessionsThisWeek}</ThemedText>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function GoalStepper({
  value,
  onChange,
  step,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
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
    <View style={styles.stepperInline}>
      {btn('−', -step)}
      <ThemedText style={styles.stepValue}>{formatMinutes(value)}</ThemedText>
      {btn('＋', step)}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  spread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { gap: Spacing.two },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    gap: Spacing.one,
  },
  barCol: { flex: 1, alignItems: 'center', gap: Spacing.one, height: '100%' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: Spacing.one, minHeight: 4 },
  subjectRow: { gap: Spacing.one, paddingVertical: Spacing.one },
  stepperInline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, fontWeight: '700' },
  stepValue: { minWidth: 72, textAlign: 'center', fontWeight: '700' },
});
