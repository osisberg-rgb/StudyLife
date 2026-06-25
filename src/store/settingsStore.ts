// Brugerindstillinger (Pomodoro-længder + notifikations-varsling). Indlæses fra
// SQLite ved app-start og persisteres ved hver ændring.
import { create } from 'zustand';

import { getSetting, setSetting } from '@/lib/db/settings';

const KEY = 'preferences';

export type Preferences = {
  workMin: number;
  breakMin: number;
  longBreakMin: number;
  cyclesBeforeLongBreak: number;
  notifLeadDays: number[]; // dage før deadline der varsles, fx [7, 1, 0]
};

const DEFAULTS: Preferences = {
  workMin: 25,
  breakMin: 5,
  longBreakMin: 15,
  cyclesBeforeLongBreak: 4,
  notifLeadDays: [7, 1, 0],
};

type SettingsState = Preferences & {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<Preferences>) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    const stored = await getSetting<Partial<Preferences>>(KEY, {});
    set({ ...DEFAULTS, ...stored, loaded: true });
  },

  update: async (patch) => {
    const next: Preferences = {
      workMin: get().workMin,
      breakMin: get().breakMin,
      longBreakMin: get().longBreakMin,
      cyclesBeforeLongBreak: get().cyclesBeforeLongBreak,
      notifLeadDays: get().notifLeadDays,
      ...patch,
    };
    set(patch);
    await setSetting(KEY, next);
  },
}));
