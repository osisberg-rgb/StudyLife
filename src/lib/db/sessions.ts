// Typede forespørgsler for StudySession. Sessionsloggen er den eneste kilde til
// statistik og streaks — vi gemmer aldrig udregnede tællere.
import type { SessionType, StudySession } from '@/types';
import { getDb, newId } from './client';

type SessionRow = {
  id: string;
  subjectId: string | null;
  type: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
};

function mapRow(r: SessionRow): StudySession {
  return {
    id: r.id,
    subjectId: r.subjectId,
    type: r.type as SessionType,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationSec: r.durationSec,
  };
}

export type SessionInput = {
  subjectId: string | null;
  type: SessionType;
  startedAt: number;
  endedAt: number;
  durationSec: number;
};

export async function createSession(input: SessionInput): Promise<StudySession> {
  const db = await getDb();
  const session: StudySession = { id: newId(), ...input };
  await db.runAsync(
    `INSERT INTO StudySession (id, subjectId, type, startedAt, endedAt, durationSec)
     VALUES (?, ?, ?, ?, ?, ?);`,
    session.id,
    session.subjectId,
    session.type,
    session.startedAt,
    session.endedAt,
    session.durationSec,
  );
  return session;
}

export async function listSessionsInRange(fromMs: number, toMs: number): Promise<StudySession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SessionRow>(
    'SELECT * FROM StudySession WHERE startedAt >= ? AND startedAt <= ? ORDER BY startedAt DESC;',
    fromMs,
    toMs,
  );
  return rows.map(mapRow);
}

/** Samlet fokustid (sekunder) i intervallet. */
export async function totalSecondsInRange(fromMs: number, toMs: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(durationSec) AS total FROM StudySession WHERE startedAt >= ? AND startedAt <= ?;',
    fromMs,
    toMs,
  );
  return row?.total ?? 0;
}

export async function sessionCountInRange(fromMs: number, toMs: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM StudySession WHERE startedAt >= ? AND startedAt <= ?;',
    fromMs,
    toMs,
  );
  return row?.n ?? 0;
}

export type SubjectTotal = {
  subjectId: string | null;
  subjectName: string | null;
  subjectColor: string | null;
  totalSec: number;
};

/** Fokustid grupperet pr. fag i intervallet (inkl. sessioner uden fag). */
export async function secondsPerSubjectInRange(
  fromMs: number,
  toMs: number,
): Promise<SubjectTotal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    subjectId: string | null;
    subjectName: string | null;
    subjectColor: string | null;
    totalSec: number;
  }>(
    `SELECT ss.subjectId AS subjectId,
            s.name       AS subjectName,
            s.color      AS subjectColor,
            SUM(ss.durationSec) AS totalSec
     FROM StudySession ss
     LEFT JOIN Subject s ON s.id = ss.subjectId
     WHERE ss.startedAt >= ? AND ss.startedAt <= ?
     GROUP BY ss.subjectId
     ORDER BY totalSec DESC;`,
    fromMs,
    toMs,
  );
  return rows;
}

/**
 * Distinkte lokale dage (som 'YYYY-MM-DD'-nøgler) med mindst én session, nyeste
 * først. Bruges til streak-beregningen sammen med dagens mål.
 */
export async function activeDaysSince(fromMs: number): Promise<{ dayKey: string; totalSec: number }[]> {
  const db = await getDb();
  // SQLite's date()/localtime regner i sekunder — gem ms/1000.
  const rows = await db.getAllAsync<{ dayKey: string; totalSec: number }>(
    `SELECT date(startedAt / 1000, 'unixepoch', 'localtime') AS dayKey,
            SUM(durationSec) AS totalSec
     FROM StudySession
     WHERE startedAt >= ?
     GROUP BY dayKey
     ORDER BY dayKey DESC;`,
    fromMs,
  );
  return rows;
}
