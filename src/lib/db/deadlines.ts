// Typede forespørgsler for Deadline. Lister joiner Subject med, så UI'et kan vise
// fag-navn og -farve uden ekstra opslag.
import type { Deadline, DeadlineSource, DeadlineWithSubject } from '@/types';
import { getDb, newId } from './client';

type DeadlineRow = {
  id: string;
  subjectId: string | null;
  title: string;
  description: string | null;
  dueDate: number;
  completed: number;
  source: string;
  createdAt: number;
};

type DeadlineJoinRow = DeadlineRow & {
  subjectName: string | null;
  subjectColor: string | null;
};

function mapJoin(r: DeadlineJoinRow): DeadlineWithSubject {
  return {
    id: r.id,
    subjectId: r.subjectId,
    title: r.title,
    description: r.description,
    dueDate: r.dueDate,
    completed: r.completed === 1,
    source: r.source as DeadlineSource,
    createdAt: r.createdAt,
    subjectName: r.subjectName,
    subjectColor: r.subjectColor,
  };
}

const SELECT_JOIN = `
  SELECT d.*, s.name AS subjectName, s.color AS subjectColor
  FROM Deadline d
  LEFT JOIN Subject s ON s.id = d.subjectId
`;

export async function listDeadlines(includeCompleted = true): Promise<DeadlineWithSubject[]> {
  const db = await getDb();
  const where = includeCompleted ? '' : 'WHERE d.completed = 0';
  const rows = await db.getAllAsync<DeadlineJoinRow>(
    `${SELECT_JOIN} ${where} ORDER BY d.dueDate ASC;`,
  );
  return rows.map(mapJoin);
}

/** Aktive (ikke-fuldførte) deadlines med forfald i intervallet [from, to]. */
export async function listDeadlinesInRange(
  fromMs: number,
  toMs: number,
): Promise<DeadlineWithSubject[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DeadlineJoinRow>(
    `${SELECT_JOIN} WHERE d.dueDate >= ? AND d.dueDate <= ? ORDER BY d.dueDate ASC;`,
    fromMs,
    toMs,
  );
  return rows.map(mapJoin);
}

export async function getDeadline(id: string): Promise<DeadlineWithSubject | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DeadlineJoinRow>(`${SELECT_JOIN} WHERE d.id = ?;`, id);
  return row ? mapJoin(row) : null;
}

export type DeadlineInput = {
  subjectId: string | null;
  title: string;
  description: string | null;
  dueDate: number;
  source: DeadlineSource;
};

export async function createDeadline(input: DeadlineInput): Promise<Deadline> {
  const db = await getDb();
  const deadline: Deadline = {
    id: newId(),
    subjectId: input.subjectId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    dueDate: input.dueDate,
    completed: false,
    source: input.source,
    createdAt: Date.now(),
  };
  await db.runAsync(
    `INSERT INTO Deadline (id, subjectId, title, description, dueDate, completed, source, createdAt)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?);`,
    deadline.id,
    deadline.subjectId,
    deadline.title,
    deadline.description,
    deadline.dueDate,
    deadline.source,
    deadline.createdAt,
  );
  return deadline;
}

export async function updateDeadline(
  id: string,
  input: Pick<DeadlineInput, 'subjectId' | 'title' | 'description' | 'dueDate'>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE Deadline SET subjectId = ?, title = ?, description = ?, dueDate = ? WHERE id = ?;`,
    input.subjectId,
    input.title.trim(),
    input.description?.trim() || null,
    input.dueDate,
    id,
  );
}

export async function setDeadlineCompleted(id: string, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE Deadline SET completed = ? WHERE id = ?;', completed ? 1 : 0, id);
}

export async function deleteDeadline(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM Deadline WHERE id = ?;', id);
}
