// Runtime-tilstand for fokus-timeren (Pomodoro + almindelig fokus). Tiden måles
// mod et vægur-anker (segmentStart + baseElapsedSec), så nedtællingen ikke
// driver, hvis appen er i baggrunden. Skærmen kalder tick(now) hvert sekund.
//
// Pomodoro tæller NED i skiftevis arbejds-/pausefaser; hver fuldført arbejdsfase
// logges som en StudySession. Fokus tæller OP (stopur) og logges når man stopper.
import { create } from 'zustand';

import { createSession } from '@/lib/db/sessions';
import { useSettingsStore } from './settingsStore';

export type TimerMode = 'pomodoro' | 'focus';
export type TimerStatus = 'idle' | 'running' | 'paused';
export type TimerPhase = 'work' | 'break';

const MIN_LOGGABLE_SEC = 60; // log ikke ministumper

type TimerState = {
  mode: TimerMode | null;
  status: TimerStatus;
  phase: TimerPhase;
  subjectId: string | null;

  phaseDurationSec: number; // længde af nuværende fase (pomodoro)
  remainingSec: number; // pomodoro-nedtælling (vises)
  elapsedSec: number; // fokus-optælling / forløbet i nuværende fase (vises)
  pomodorosCompleted: number;

  // ankre (ikke til visning):
  segmentStart: number | null; // vægur-ms da nuværende kørende segment startede
  baseElapsedSec: number; // forløbet i fasen før nuværende segment
  sessionStartedAt: number | null; // vægur-start på nuværende arbejds-/fokus-blok

  startPomodoro: (subjectId: string | null) => void;
  startFocus: (subjectId: string | null) => void;
  pause: (now?: number) => void;
  resume: (now?: number) => void;
  skip: (now?: number) => void; // pomodoro: afslut nuværende fase nu
  stop: (now?: number) => void; // afslut helt (logger fokus/arbejde)
  tick: (now?: number) => void;
};

function elapsedInPhase(s: TimerState, now: number): number {
  const segment = s.status === 'running' && s.segmentStart ? (now - s.segmentStart) / 1000 : 0;
  return s.baseElapsedSec + segment;
}

async function logWork(
  subjectId: string | null,
  type: TimerMode,
  startedAt: number,
  endedAt: number,
): Promise<void> {
  const durationSec = Math.round((endedAt - startedAt) / 1000);
  if (durationSec < MIN_LOGGABLE_SEC) return;
  try {
    await createSession({ subjectId, type, startedAt, endedAt, durationSec });
  } catch {
    // Logning må aldrig vælte timeren — ignorér stille (data er ikke kritisk her).
  }
}

export const useTimerStore = create<TimerState>((set, get) => ({
  mode: null,
  status: 'idle',
  phase: 'work',
  subjectId: null,
  phaseDurationSec: 0,
  remainingSec: 0,
  elapsedSec: 0,
  pomodorosCompleted: 0,
  segmentStart: null,
  baseElapsedSec: 0,
  sessionStartedAt: null,

  startPomodoro: (subjectId) => {
    const now = Date.now();
    const { workMin } = useSettingsStore.getState();
    const dur = Math.max(1, Math.round(workMin)) * 60;
    set({
      mode: 'pomodoro',
      status: 'running',
      phase: 'work',
      subjectId,
      phaseDurationSec: dur,
      remainingSec: dur,
      elapsedSec: 0,
      pomodorosCompleted: 0,
      segmentStart: now,
      baseElapsedSec: 0,
      sessionStartedAt: now,
    });
  },

  startFocus: (subjectId) => {
    const now = Date.now();
    set({
      mode: 'focus',
      status: 'running',
      phase: 'work',
      subjectId,
      phaseDurationSec: 0,
      remainingSec: 0,
      elapsedSec: 0,
      pomodorosCompleted: 0,
      segmentStart: now,
      baseElapsedSec: 0,
      sessionStartedAt: now,
    });
  },

  pause: (now = Date.now()) => {
    const s = get();
    if (s.status !== 'running') return;
    const elapsed = elapsedInPhase(s, now);
    set({ status: 'paused', baseElapsedSec: elapsed, segmentStart: null });
  },

  resume: (now = Date.now()) => {
    const s = get();
    if (s.status !== 'paused') return;
    set({ status: 'running', segmentStart: now });
  },

  skip: (now = Date.now()) => {
    const s = get();
    if (s.mode !== 'pomodoro' || s.status === 'idle') return;
    void completePhase(set, get, now, /* reachedZeroNaturally */ false);
  },

  stop: (now = Date.now()) => {
    const s = get();
    if (s.mode === 'focus' && s.sessionStartedAt) {
      void logWork(s.subjectId, 'focus', s.sessionStartedAt, now);
    } else if (s.mode === 'pomodoro' && s.phase === 'work' && s.sessionStartedAt) {
      // Manuel stop midt i en arbejdsfase: log det faktisk forløbne arbejde.
      const elapsed = elapsedInPhase(s, now);
      if (elapsed >= MIN_LOGGABLE_SEC) {
        void logWork(s.subjectId, 'pomodoro', s.sessionStartedAt, s.sessionStartedAt + elapsed * 1000);
      }
    }
    set({
      mode: null,
      status: 'idle',
      phase: 'work',
      phaseDurationSec: 0,
      remainingSec: 0,
      elapsedSec: 0,
      pomodorosCompleted: 0,
      segmentStart: null,
      baseElapsedSec: 0,
      sessionStartedAt: null,
    });
  },

  tick: (now = Date.now()) => {
    const s = get();
    if (s.status !== 'running') return;
    const elapsed = elapsedInPhase(s, now);

    if (s.mode === 'pomodoro') {
      const remaining = Math.max(0, s.phaseDurationSec - Math.floor(elapsed));
      set({ remainingSec: remaining, elapsedSec: Math.floor(elapsed) });
      if (remaining <= 0) {
        void completePhase(set, get, now, true);
      }
    } else if (s.mode === 'focus') {
      set({ elapsedSec: Math.floor(elapsed) });
    }
  },
}));

// Afslut nuværende pomodoro-fase og skift til den næste. Logger arbejdsfaser.
async function completePhase(
  set: (partial: Partial<TimerState>) => void,
  get: () => TimerState,
  now: number,
  reachedZeroNaturally: boolean,
): Promise<void> {
  const s = get();
  const prefs = useSettingsStore.getState();

  if (s.phase === 'work') {
    // Log arbejdsfasen: fuld varighed hvis tiden løb ud, ellers det forløbne.
    const workSec = reachedZeroNaturally
      ? s.phaseDurationSec
      : Math.floor(elapsedInPhase(s, now));
    if (s.sessionStartedAt && workSec >= MIN_LOGGABLE_SEC) {
      await logWork(s.subjectId, 'pomodoro', s.sessionStartedAt, s.sessionStartedAt + workSec * 1000);
    }
    const done = s.pomodorosCompleted + 1;
    const longBreak = done % Math.max(1, prefs.cyclesBeforeLongBreak) === 0;
    const breakMin = longBreak ? prefs.longBreakMin : prefs.breakMin;
    const dur = Math.max(1, Math.round(breakMin)) * 60;
    set({
      phase: 'break',
      pomodorosCompleted: done,
      phaseDurationSec: dur,
      remainingSec: dur,
      elapsedSec: 0,
      segmentStart: now,
      baseElapsedSec: 0,
      sessionStartedAt: null,
      status: 'running',
    });
  } else {
    // Pause færdig → ny arbejdsfase.
    const dur = Math.max(1, Math.round(prefs.workMin)) * 60;
    set({
      phase: 'work',
      phaseDurationSec: dur,
      remainingSec: dur,
      elapsedSec: 0,
      segmentStart: now,
      baseElapsedSec: 0,
      sessionStartedAt: now,
      status: 'running',
    });
  }
}
