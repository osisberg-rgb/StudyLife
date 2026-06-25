// Typede forespørgsler for Goal. Der findes præcis ét daglig- og ét ugentlig-mål;
// vi opretter dem med fornuftige standardværdier ved første kald.
import type { Goal, GoalPeriod } from '@/types';
import { getDb, newId } from './client';

const DEFAULTS: Record<GoalPeriod, number> = {
  daily: 120, // 2 timer
  weekly: 600, // 10 timer
};

type GoalRow = {
  id: string;
  period: string;
  targetMin: number;
  createdAt: number;
};

function mapRow(r: GoalRow): Goal {
  return { id: r.id, period: r.period as GoalPeriod, targetMin: r.targetMin, createdAt: r.createdAt };
}

async function ensureGoal(period: GoalPeriod): Promise<Goal> {
  const db = await getDb();
  const existing = await db.getFirstAsync<GoalRow>('SELECT * FROM Goal WHERE period = ?;', period);
  if (existing) return mapRow(existing);
  const goal: Goal = { id: newId(), period, targetMin: DEFAULTS[period], createdAt: Date.now() };
  await db.runAsync(
    'INSERT INTO Goal (id, period, targetMin, createdAt) VALUES (?, ?, ?, ?);',
    goal.id,
    goal.period,
    goal.targetMin,
    goal.createdAt,
  );
  return goal;
}

export async function getGoals(): Promise<{ daily: Goal; weekly: Goal }> {
  const [daily, weekly] = await Promise.all([ensureGoal('daily'), ensureGoal('weekly')]);
  return { daily, weekly };
}

export async function setGoalTarget(period: GoalPeriod, targetMin: number): Promise<void> {
  await ensureGoal(period); // sikrer rækken findes
  const db = await getDb();
  await db.runAsync('UPDATE Goal SET targetMin = ? WHERE period = ?;', Math.max(0, Math.round(targetMin)), period);
}
