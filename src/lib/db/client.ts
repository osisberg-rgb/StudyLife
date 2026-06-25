// SQLite-klient: åbner databasen én gang (singleton) og kører migrationer via
// PRAGMA user_version. Alle skærme tilgår data via de typede funktioner i de
// øvrige filer her i lib/db — aldrig rå SQL direkte i UI'et.
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'studylife.db';

// Hver migration bumper user_version med 1. Tilføj nye trin i bunden — rediger
// aldrig en eksisterende migration, da brugere kan have kørt den allerede.
const MIGRATIONS: string[] = [
  // v1 — grundskema
  `
  CREATE TABLE IF NOT EXISTS Subject (
    id        TEXT PRIMARY KEY NOT NULL,
    name      TEXT NOT NULL,
    color     TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Deadline (
    id          TEXT PRIMARY KEY NOT NULL,
    subjectId   TEXT REFERENCES Subject(id) ON DELETE SET NULL,
    title       TEXT NOT NULL,
    description TEXT,
    dueDate     INTEGER NOT NULL,
    completed   INTEGER NOT NULL DEFAULT 0,
    source      TEXT NOT NULL,
    createdAt   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_deadline_due ON Deadline(dueDate);

  CREATE TABLE IF NOT EXISTS NotificationSchedule (
    id         TEXT PRIMARY KEY NOT NULL,
    deadlineId TEXT NOT NULL REFERENCES Deadline(id) ON DELETE CASCADE,
    fireAt     INTEGER NOT NULL,
    notifId    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notif_deadline ON NotificationSchedule(deadlineId);

  CREATE TABLE IF NOT EXISTS StudySession (
    id          TEXT PRIMARY KEY NOT NULL,
    subjectId   TEXT REFERENCES Subject(id) ON DELETE SET NULL,
    type        TEXT NOT NULL,
    startedAt   INTEGER NOT NULL,
    endedAt     INTEGER NOT NULL,
    durationSec INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_session_started ON StudySession(startedAt);

  CREATE TABLE IF NOT EXISTS Goal (
    id        TEXT PRIMARY KEY NOT NULL,
    period    TEXT NOT NULL,
    targetMin INTEGER NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS Setting (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  let version = row?.user_version ?? 0;

  for (let i = version; i < MIGRATIONS.length; i++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[i]);
    });
    version = i + 1;
    // PRAGMA user_version tager ikke parametre — derfor inline (sikkert: tal).
    await db.execAsync(`PRAGMA user_version = ${version};`);
  }

  return db;
}

/** Hent den delte database-instans (åbner + migrerer ved første kald). */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

/** Kald én gang ved app-start for at sikre skemaet er på plads. */
export async function initDb(): Promise<void> {
  await getDb();
}

/** Enkel, kollisionssikker nok id-generator til lokale primærnøgler. */
export function newId(): string {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}
