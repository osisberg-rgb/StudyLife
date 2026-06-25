// Typede forespørgsler for NotificationSchedule. Holder styr på hvilke
// expo-notifications-id'er der hører til hvilken deadline, så vi kan aflyse dem
// igen når en deadline ændres, fuldføres eller slettes.
import type { NotificationSchedule } from '@/types';
import { getDb, newId } from './client';

type Row = {
  id: string;
  deadlineId: string;
  fireAt: number;
  notifId: string;
};

export async function listSchedulesForDeadline(deadlineId: string): Promise<NotificationSchedule[]> {
  const db = await getDb();
  return db.getAllAsync<Row>('SELECT * FROM NotificationSchedule WHERE deadlineId = ?;', deadlineId);
}

export async function addSchedule(
  deadlineId: string,
  fireAt: number,
  notifId: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO NotificationSchedule (id, deadlineId, fireAt, notifId) VALUES (?, ?, ?, ?);',
    newId(),
    deadlineId,
    fireAt,
    notifId,
  );
}

export async function deleteSchedulesForDeadline(deadlineId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM NotificationSchedule WHERE deadlineId = ?;', deadlineId);
}
