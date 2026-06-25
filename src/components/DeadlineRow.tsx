import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { SubjectPill } from '@/components/SubjectPill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/lib/dates';
import type { DeadlineWithSubject } from '@/types';

type Props = {
  deadline: DeadlineWithSubject;
  onToggle: (id: string, completed: boolean) => void;
  onPress: (id: string) => void;
  // Nuværende tid sendes ind (regnes i kalderens reload, ikke under render) så
  // "forfaldt"-markeringen forbliver en ren funktion af props.
  now: number;
  // Hvis sat, kan rækken swipes til venstre for at slette.
  onDelete?: (id: string) => void;
  showTime?: boolean;
};

export function DeadlineRow({ deadline, onToggle, onPress, now, onDelete, showTime = true }: Props) {
  const theme = useTheme();
  const overdue = !deadline.completed && deadline.dueDate < now;
  const swipeRef = useRef<SwipeableMethods>(null);

  const content = (
    <Pressable
      onPress={() => onPress(deadline.id)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
      ]}>
      <Pressable
        hitSlop={10}
        onPress={() => onToggle(deadline.id, !deadline.completed)}
        style={[
          styles.check,
          {
            borderColor: deadline.completed ? theme.success : theme.textSecondary,
            backgroundColor: deadline.completed ? theme.success : 'transparent',
          },
        ]}>
        {deadline.completed && <ThemedText style={styles.checkMark}>✓</ThemedText>}
      </Pressable>

      <View style={styles.body}>
        <ThemedText
          numberOfLines={1}
          style={[
            styles.title,
            deadline.completed && { textDecorationLine: 'line-through', color: theme.textSecondary },
          ]}>
          {deadline.title}
        </ThemedText>
        <View style={styles.metaRow}>
          {deadline.subjectName && deadline.subjectColor && (
            <SubjectPill name={deadline.subjectName} color={deadline.subjectColor} />
          )}
          {showTime && (
            <ThemedText
              type="small"
              style={{ color: overdue ? theme.danger : theme.textSecondary }}>
              {overdue ? 'Forfaldt · ' : ''}
              {formatTime(deadline.dueDate)}
            </ThemedText>
          )}
        </View>
        {deadline.description && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {deadline.description}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );

  if (!onDelete) return content;

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onDelete(deadline.id);
          }}
          style={[styles.deleteAction, { backgroundColor: theme.danger }]}>
          <ThemedText style={styles.deleteText}>Slet</ThemedText>
        </Pressable>
      )}>
      {content}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginLeft: Spacing.two,
    borderRadius: Spacing.three,
  },
  deleteText: {
    color: '#fff',
    fontWeight: '700',
  },
});
