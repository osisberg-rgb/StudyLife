// Lokale notifikationer pr. deadline. Vi planlægger én notifikation pr.
// varslings-led (fx 7 dage / 1 dag / på dagen) og gemmer de returnerede
// expo-notifications-id'er i NotificationSchedule, så de kan aflyses igen.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import * as deadlinesDb from '@/lib/db/deadlines';
import * as schedulesDb from '@/lib/db/notificationSchedules';
import { formatDayLabel } from '@/lib/dates';
import type { Deadline } from '@/types';

// Vis banner + lyd også når appen er åben.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Bed om tilladelse til notifikationer. Returnerer true hvis givet. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('deadlines', {
      name: 'Deadlines',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

function leadLabel(leadDays: number): string {
  if (leadDays === 0) return 'er i dag';
  if (leadDays === 1) return 'er i morgen';
  return `om ${leadDays} dage`;
}

/**
 * Planlæg notifikationer for en deadline ud fra varslings-leddene (dage før).
 * Springer led over hvis affyringstidspunktet allerede er passeret. Aflyser
 * altid eksisterende notifikationer for deadlinen først (idempotent).
 */
export async function scheduleDeadlineNotifications(
  deadline: Deadline,
  leadDays: number[],
): Promise<void> {
  await cancelDeadlineNotifications(deadline.id);
  if (deadline.completed) return;

  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const now = Date.now();
  const dayMs = 86_400_000;

  for (const lead of leadDays) {
    const fireAt = deadline.dueDate - lead * dayMs;
    if (fireAt <= now) continue; // ingen grund til at planlægge i fortiden

    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: deadline.title,
        body:
          lead === 0
            ? `Deadline ${leadLabel(lead)}!`
            : `Deadline ${leadLabel(lead)} (${formatDayLabel(deadline.dueDate)})`,
        // deadlineId bæres med, så et tryk på notifikationen kan åbne deadlinen.
        data: { deadlineId: deadline.id },
        ...(Platform.OS === 'android' ? { channelId: 'deadlines' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });

    await schedulesDb.addSchedule(deadline.id, fireAt, notifId);
  }
}

/** Aflys alle planlagte notifikationer for en deadline og ryd op i DB. */
export async function cancelDeadlineNotifications(deadlineId: string): Promise<void> {
  const existing = await schedulesDb.listSchedulesForDeadline(deadlineId);
  await Promise.all(
    existing.map((s) =>
      Notifications.cancelScheduledNotificationAsync(s.notifId).catch(() => undefined),
    ),
  );
  await schedulesDb.deleteSchedulesForDeadline(deadlineId);
}

/**
 * Genplanlæg alle aktive deadlines med de(t) givne varslings-led. Bruges når
 * brugeren ændrer varslings-indstillingen, så eksisterende deadlines følger med.
 */
export async function rescheduleAllDeadlines(leadDays: number[]): Promise<void> {
  const active = await deadlinesDb.listDeadlines(false);
  for (const d of active) {
    await scheduleDeadlineNotifications(d, leadDays);
  }
}
