import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Lille farvet pille der viser et fag. Farven kommer fra fagets gemte hex.
export function SubjectPill({ name, color }: { name: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + '22' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <ThemedText type="small" style={[styles.label, { color }]} numberOfLines={1}>
        {name}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: 2,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontWeight: '700',
  },
});
