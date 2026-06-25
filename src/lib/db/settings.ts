// Key-value-indstillinger (Pomodoro-længder, notifikations-varsling). Værdier
// gemmes som JSON-tekst. Domænet for indstillingerne ligger i store/settingsStore.
import { getDb } from './client';

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM Setting WHERE key = ?;', key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO Setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;',
    key,
    JSON.stringify(value),
  );
}
