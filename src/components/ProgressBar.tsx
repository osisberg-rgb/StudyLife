import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

// Andel 0..1. Klippes så den aldrig går under 0 eller over 1.
export function ProgressBar({ progress, color }: { progress: number; color?: string }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View
        style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color ?? theme.accent }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
