import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DeadlineRow } from '@/components/DeadlineRow';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as deadlinesDb from '@/lib/db/deadlines';
import * as subjectsDb from '@/lib/db/subjects';
import { dayKey, formatGroupHeading } from '@/lib/dates';
import { cancelDeadlineNotifications } from '@/lib/notifications';
import type { DeadlineWithSubject, Subject } from '@/types';

type Group = { key: string; heading: string; items: DeadlineWithSubject[] };

function groupByDay(deadlines: DeadlineWithSubject[]): Group[] {
  const map = new Map<string, DeadlineWithSubject[]>();
  for (const d of deadlines) {
    const key = dayKey(d.dueDate);
    const arr = map.get(key);
    if (arr) arr.push(d);
    else map.set(key, [d]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, items]) => ({
      key,
      heading: formatGroupHeading(items[0].dueDate),
      items,
    }));
}

export default function DeadlinesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [all, setAll] = useState<DeadlineWithSubject[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filter, setFilter] = useState<string | null>(null); // valgt subjectId
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const [list, subs] = await Promise.all([
      deadlinesDb.listDeadlines(true),
      subjectsDb.listSubjects(),
    ]);
    setNow(Date.now());
    setAll(list);
    setSubjects(subs);
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

  const groups = useMemo(() => {
    const filtered = filter ? all.filter((d) => d.subjectId === filter) : all;
    return groupByDay(filtered);
  }, [all, filter]);

  const toggle = useCallback(
    async (id: string, completed: boolean) => {
      await deadlinesDb.setDeadlineCompleted(id, completed);
      if (completed) await cancelDeadlineNotifications(id);
      reload();
    },
    [reload],
  );

  const del = useCallback(
    async (id: string) => {
      await cancelDeadlineNotifications(id);
      await deadlinesDb.deleteDeadline(id);
      reload();
    },
    [reload],
  );

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.headerRow}>
          <ThemedText type="subtitle">Deadlines</ThemedText>
          <View style={styles.headerActions}>
            <Pressable hitSlop={8} onPress={() => router.push('/import')}>
              <ThemedText style={[styles.headerBtn, { color: theme.accent }]}>Importér</ThemedText>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => router.push('/deadline/new')}>
              <ThemedText style={[styles.plus, { color: theme.accent }]}>＋</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Fag-filter */}
        {subjects.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}>
            <FilterChip label="Alle" active={filter === null} onPress={() => setFilter(null)} />
            {subjects.map((s) => (
              <FilterChip
                key={s.id}
                label={s.name}
                color={s.color}
                active={filter === s.id}
                onPress={() => setFilter(filter === s.id ? null : s.id)}
              />
            ))}
          </ScrollView>
        )}

        {all.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText type="title" style={styles.emptyEmoji}>
              🗓️
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Ingen deadlines endnu. Importér din semesterplan eller tilføj en manuelt.
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
            }>
            {groups.length === 0 && (
              <ThemedText themeColor="textSecondary">Ingen deadlines for dette fag.</ThemedText>
            )}
            {groups.map((g) => (
              <View key={g.key} style={styles.group}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {g.heading}
                </ThemedText>
                <View style={styles.list}>
                  {g.items.map((d) => (
                    <DeadlineRow
                      key={d.id}
                      deadline={d}
                      now={now}
                      onToggle={toggle}
                      onDelete={del}
                      onPress={(id) => router.push(`/deadline/${id}`)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function FilterChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? (color ?? theme.accent) : theme.backgroundElement,
        },
      ]}>
      <ThemedText
        type="small"
        style={{ color: active ? '#fff' : theme.text, fontWeight: '600' }}
        numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  headerBtn: { fontSize: 16, fontWeight: '600' },
  plus: { fontSize: 28, fontWeight: '400', lineHeight: 30 },
  filterRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  filterChip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
    maxWidth: 160,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
    paddingBottom: Spacing.six,
  },
  group: { gap: Spacing.two },
  list: { gap: Spacing.two },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.three,
  },
  emptyEmoji: { fontSize: 56, lineHeight: 64 },
  emptyText: { textAlign: 'center' },
});
