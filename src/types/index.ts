// Domænetyper for StudyLife. Alle datoer er epoch-ms (UTC) — formattér først ved
// visning. Disse typer matcher 1:1 SQLite-skemaet i lib/db.

export type DeadlineSource = 'ai' | 'manual';
export type SessionType = 'pomodoro' | 'focus';
export type GoalPeriod = 'daily' | 'weekly';

export type Subject = {
  id: string;
  name: string;
  color: string; // hex, til pills/labels
  createdAt: number; // epoch ms
};

export type Deadline = {
  id: string;
  subjectId: string | null;
  title: string;
  description: string | null;
  dueDate: number; // epoch ms
  completed: boolean;
  source: DeadlineSource;
  createdAt: number; // epoch ms
};

// Deadline beriget med dens fag (til lister, så vi slipper for ekstra opslag).
export type DeadlineWithSubject = Deadline & {
  subjectName: string | null;
  subjectColor: string | null;
};

export type NotificationSchedule = {
  id: string;
  deadlineId: string;
  fireAt: number; // epoch ms
  notifId: string; // id fra expo-notifications
};

export type StudySession = {
  id: string;
  subjectId: string | null;
  type: SessionType;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  durationSec: number;
};

export type Goal = {
  id: string;
  period: GoalPeriod;
  targetMin: number;
  createdAt: number; // epoch ms
};

// Resultatet af AI-udtrækningen, før brugeren har bekræftet. `dueDate` kan være
// null hvis modellen ikke var sikker — så flagges rækken i review-skærmen.
export type ExtractedDeadline = {
  title: string;
  subject: string | null;
  dueDate: string | null; // 'YYYY-MM-DD'
  description: string | null;
};
