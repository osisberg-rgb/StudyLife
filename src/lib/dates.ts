// Dato-hjælpere. Alt gemmes som epoch-ms; her formatteres og grupperes der, hvor
// det vises. Uge starter mandag (dansk konvention).

const MS_PER_DAY = 86_400_000;

export const DEFAULT_DUE_HOUR = 9; // date-only deadlines forfalder kl. 09:00 lokal tid

/** Epoch-ms for lokal midnat på dagen som `ms` ligger i. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Mandag kl. 00:00 i ugen som `ms` ligger i. */
export function startOfWeek(ms: number): number {
  const d = new Date(ms);
  const day = d.getDay(); // 0 = søndag
  const diff = day === 0 ? 6 : day - 1; // antal dage siden mandag
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfWeek(ms: number): number {
  return startOfWeek(ms) + 7 * MS_PER_DAY - 1;
}

export function addDays(ms: number, days: number): number {
  return ms + days * MS_PER_DAY;
}

/** Hele kalenderdage mellem to tidspunkter (kan være negativ). */
export function daysBetween(fromMs: number, toMs: number): number {
  return Math.round((startOfDay(toMs) - startOfDay(fromMs)) / MS_PER_DAY);
}

/** Stabil grupperingsnøgle pr. lokal dag, fx "2026-09-15". */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Konvertér 'YYYY-MM-DD' til epoch-ms på lokal tid kl. `hour`. Returnerer null
 * ved ugyldigt format, så kalderen kan flagge det i review-skærmen.
 */
export function isoDateToEpoch(iso: string, hour = DEFAULT_DUE_HOUR): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day, hour, 0, 0, 0);
  // Fang fx 31. februar, som Date ellers ruller frem.
  if (d.getMonth() !== month - 1) return null;
  return d.getTime();
}

/** Epoch-ms → 'YYYY-MM-DD' (lokal). */
export function epochToIsoDate(ms: number): string {
  return dayKey(ms);
}

const DA_DAYS = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
const DA_MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

/** Fx "Man 15. sep". */
export function formatDayLabel(ms: number): string {
  const d = new Date(ms);
  return `${DA_DAYS[d.getDay()]} ${d.getDate()}. ${DA_MONTHS[d.getMonth()]}`;
}

/** Menneskevenlig dag-overskrift til deadline-grupper. */
export function formatGroupHeading(ms: number, now = Date.now()): string {
  const diff = daysBetween(now, ms);
  if (diff === 0) return 'I dag';
  if (diff === 1) return 'I morgen';
  if (diff === -1) return 'I går';
  if (diff < 0) return `${formatDayLabel(ms)} (forfaldt)`;
  return formatDayLabel(ms);
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Fx "15. sep 2026". */
export function formatFullDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()}. ${DA_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Minutter → "1t 25m" / "25m". */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}
