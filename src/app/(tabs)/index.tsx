import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DeadlineRow } from '@/components/DeadlineRow';
import { ProgressBar } from '@/components/ProgressBar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as deadlinesDb from '@/lib/db/deadlines';
import { addDays, endOfDay, formatFullDate, formatMinutes, startOfDay } from '@/lib/dates';
import { cancelDeadlineNotifications } from '@/lib/notifications';
import { loadTodaySummary, type TodaySummary } from '@/lib/stats';
import type { DeadlineWithSubject } from '@/types';

export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [today, setToday] = useState<DeadlineWithSubject[]>([]);
  const [overdue, setOverdue] = useState<DeadlineWithSubject[]>([]);
  const [upcoming, setUpcoming] = useState<DeadlineWithSubject[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const ts = Date.now();
    const [s, all] = await Promise.all([
      loadTodaySummary(ts),
      deadlinesDb.listDeadlines(false),
    ]);
    const ds = startOfDay(ts);
    const de = endOfDay(ts);
    setNow(ts);
    setSummary(s);
    setOverdue(all.filter((d) => d.dueDate < ds));
    setToday(all.filter((d) => d.dueDate >= ds && d.dueDate <= de));
    setUpcoming(all.filter((d) => d.dueDate > de && d.dueDate <= addDays(ds, 8)).slice(0, 6));
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

  const toggle = useCallback(
    async (id: string, completed: boolean) => {
      await deadlinesDb.setDeadlineCompleted(id, completed);
      if (completed) await cancelDeadlineNotifications(id);
      reload();
    },
    [reload],
  );

  const goalPct = summary && summary.dailyGoalMin > 0 ? summary.todayMin / summary.dailyGoalMin : 0;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="subtitle">I dag</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatFullDate(now)}
              </ThemedText>
            </View>
            <Pressable hitSlop={10} onPress={() => router.push('/settings')}>
              <ThemedText style={styles.gear}>⚙︎</ThemedText>
            </Pressable>
          </View>

          <Card>
            <View style={styles.spread}>
              <ThemedText type="smallBold">Studietid i dag</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {summary ? `${formatMinutes(summary.todayMin)} / ${formatMinutes(summary.dailyGoalMin)}` : '—'}
              </ThemedText>
            </View>
            <ProgressBar progress={goalPct} />
            <View style={styles.spread}>
              <ThemedText type="small" themeColor="textSecondary">
                🔥 {summary?.streak ?? 0} dages streak
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Uge: {summary ? formatMinutes(summary.weekMin) : '—'}
              </ThemedText>
            </View>
          </Card>

          <View style={styles.actions}>
            <Button
              title="Importér plan"
              variant="secondary"
              style={styles.flex}
              onPress={() => router.push('/import')}
            />
            <Button title="Start fokus" style={styles.flex} onPress={() => router.push('/focus')} />
          </View>

          {overdue.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold" style={{ color: theme.danger }}>
                Forfaldne ({overdue.length})
              </ThemedText>
              <View style={styles.list}>
                {overdue.map((d) => (
                  <DeadlineRow
                    key={d.id}
                    deadline={d}
                    now={now}
                    onToggle={toggle}
                    onPress={(id) => router.push(`/deadline/${id}`)}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <ThemedText type="smallBold">Deadlines i dag</ThemedText>
            {today.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Ingen deadlines i dag. 🎉
              </ThemedText>
            ) : (
              <View style={styles.list}>
                {today.map((d) => (
                  <DeadlineRow
                    key={d.id}
                    deadline={d}
                    now={now}
                    onToggle={toggle}
                    onPress={(id) => router.push(`/deadline/${id}`)}
                  />
                ))}
              </View>
            )}
          </View>

          {upcoming.length > 0 && (
            <View style={styles.section}>
              <ThemedText type="smallBold">Kommende (7 dage)</ThemedText>
              <View style={styles.list}>
                {upcoming.map((d) => (
                  <DeadlineRow
                    key={d.id}
                    deadline={d}
                    now={now}
                    onToggle={toggle}
                    onPress={(id) => router.push(`/deadline/${id}`)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerText: { gap: Spacing.one },
  gear: { fontSize: 26 },
  spread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  section: { gap: Spacing.two },
  list: { gap: Spacing.two },
});
