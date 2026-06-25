// Typede forespørgsler for Subject. Fag oprettes manuelt eller automatisk under
// AI-import (getOrCreateByName).
import { colorForSubjectName } from '@/constants/subjectColors';
import type { Subject } from '@/types';
import { getDb, newId } from './client';

type SubjectRow = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

function mapRow(r: SubjectRow): Subject {
  return { id: r.id, name: r.name, color: r.color, createdAt: r.createdAt };
}

export async function listSubjects(): Promise<Subject[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SubjectRow>('SELECT * FROM Subject ORDER BY name COLLATE NOCASE;');
  return rows.map(mapRow);
}

export async function getSubject(id: string): Promise<Subject | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SubjectRow>('SELECT * FROM Subject WHERE id = ?;', id);
  return row ? mapRow(row) : null;
}

export async function createSubject(name: string, color?: string): Promise<Subject> {
  const db = await getDb();
  const subject: Subject = {
    id: newId(),
    name: name.trim(),
    color: color ?? colorForSubjectName(name.trim()),
    createdAt: Date.now(),
  };
  await db.runAsync(
    'INSERT INTO Subject (id, name, color, createdAt) VALUES (?, ?, ?, ?);',
    subject.id,
    subject.name,
    subject.color,
    subject.createdAt,
  );
  return subject;
}

export async function updateSubject(id: string, name: string, color: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE Subject SET name = ?, color = ? WHERE id = ?;', name.trim(), color, id);
}

export async function deleteSubject(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM Subject WHERE id = ?;', id);
}

/** Find et fag på navn (case-insensitivt) eller opret det. Bruges af AI-import. */
export async function getOrCreateSubjectByName(name: string): Promise<Subject> {
  const trimmed = name.trim();
  const db = await getDb();
  const existing = await db.getFirstAsync<SubjectRow>(
    'SELECT * FROM Subject WHERE name = ? COLLATE NOCASE;',
    trimmed,
  );
  if (existing) return mapRow(existing);
  return createSubject(trimmed);
}
