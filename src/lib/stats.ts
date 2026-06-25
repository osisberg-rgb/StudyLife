// Afledt statistik og streaks. Alt regnes ud fra StudySession + Goal — vi gemmer
// aldrig udregnede tællere, så tallene altid er konsistente med sessionsloggen.
import * as goalsDb from '@/lib/db/goals';
import * as sessionsDb from '@/lib/db/sessions';
import type { SubjectTotal } from '@/lib/db/sessions';
import { addDays, dayKey, startOfDay, startOfWeek } from '@/lib/dates';

export type TodaySummary = {
  todayMin: number;
  dailyGoalMin: number;
  weekMin: number;
  weeklyGoalMin: number;
  streak: number;
};

/** Beregn streak: antal sammenhængende dage hvor dagsmålet er nået. */
function computeStreak(
  byDay: Map<string, number>,
  dailyGoalSec: number,
  now: number,
): number {
  if (dailyGoalSec <= 0) return 0;
  let cursor = startOfDay(now);
  // Dagen er ikke "tabt" før den er omme: hvis i dag endnu ikke er nået, så
  // tæl streaken op til og med i går i stedet for at vise 0 midt på dagen.
  if ((byDay.get(dayKey(cursor)) ?? 0) < dailyGoalSec) {
    cursor = startOfDay(addDays(cursor, -1));
  }
  let streak = 0;
  while ((byDay.get(dayKey(cursor)) ?? 0) >= dailyGoalSec) {
    streak++;
    cursor = startOfDay(addDays(cursor, -1));
  }
  return streak;
}

export async function loadTodaySummary(now = Date.now()): Promise<TodaySummary> {
  const dayStart = startOfDay(now);
  const dayEnd = dayStart + 86_399_999;
  const weekStart = startOfWeek(now);
  const weekEnd = weekStart + 7 * 86_400_000 - 1;

  const [todaySec, weekSec, goals, activeDays] = await Promise.all([
    sessionsDb.totalSecondsInRange(dayStart, dayEnd),
    sessionsDb.totalSecondsInRange(weekStart, weekEnd),
    goalsDb.getGoals(),
    sessionsDb.activeDaysSince(addDays(dayStart, -400)),
  ]);

  const byDay = new Map(activeDays.map((d) => [d.dayKey, d.totalSec]));
  const streak = computeStreak(byDay, goals.daily.targetMin * 60, now);

  return {
    todayMin: Math.round(todaySec / 60),
    dailyGoalMin: goals.daily.targetMin,
    weekMin: Math.round(weekSec / 60),
    weeklyGoalMin: goals.weekly.targetMin,
    streak,
  };
}

export type DayBar = { dayKey: string; label: string; minutes: number };

export type StatsOverview = TodaySummary & {
  last7Days: DayBar[];
  perSubjectWeek: SubjectTotal[];
  sessionsThisWeek: number;
};

const DA_DAYS_SHORT = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];

export async function loadStatsOverview(now = Date.now()): Promise<StatsOverview> {
  const summary = await loadTodaySummary(now);

  const weekStart = startOfWeek(now);
  const weekEnd = weekStart + 7 * 86_400_000 - 1;

  // Sidste 7 dage (inkl. i dag), ældst → nyest.
  const dayStart = startOfDay(now);
  const from = addDays(dayStart, -6);
  const [activeDays, perSubjectWeek, sessionsThisWeek] = await Promise.all([
    sessionsDb.activeDaysSince(from),
    sessionsDb.secondsPerSubjectInRange(weekStart, weekEnd),
    sessionsDb.sessionCountInRange(weekStart, weekEnd),
  ]);

  const byDay = new Map(activeDays.map((d) => [d.dayKey, d.totalSec]));
  const last7Days: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const ms = addDays(dayStart, -i);
    const key = dayKey(ms);
    last7Days.push({
      dayKey: key,
      label: DA_DAYS_SHORT[new Date(ms).getDay()],
      minutes: Math.round((byDay.get(key) ?? 0) / 60),
    });
  }

  return { ...summary, last7Days, perSubjectWeek, sessionsThisWeek };
}
