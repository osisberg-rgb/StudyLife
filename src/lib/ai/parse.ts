// Defensiv parsing af modellens svar. AI-udtræk er aldrig 100% — vi strippe
// evt. ``` -fences, prøver JSON.parse i try/catch, og hvis det fejler giver vi
// kalderen rå-teksten tilbage så UI'et kan vise den i stedet for at crashe.
import type { ExtractedDeadline } from '@/types';

export type ParseResult =
  | { ok: true; deadlines: ExtractedDeadline[] }
  | { ok: false; raw: string; error: string };

/** Fjern markdown-fences (```json ... ```) hvis modellen kom til at tilføje dem. */
function stripFences(text: string): string {
  let t = text.trim();
  // Find første { og sidste } — robust mod indledende/efterfølgende prosa.
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return t.trim();
}

function toStringOrNull(v: unknown): string | null {
  if (typeof v === 'string') {
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

export function parseExtraction(text: string): ParseResult {
  const cleaned = stripFences(text);
  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, raw: text, error: e instanceof Error ? e.message : 'Ugyldig JSON' };
  }

  if (typeof data !== 'object' || data === null || !Array.isArray((data as { deadlines?: unknown }).deadlines)) {
    return { ok: false, raw: text, error: 'JSON mangler "deadlines"-array' };
  }

  const rawList = (data as { deadlines: unknown[] }).deadlines;
  const deadlines: ExtractedDeadline[] = [];
  for (const item of rawList) {
    if (typeof item !== 'object' || item === null) continue;
    const obj = item as Record<string, unknown>;
    const title = toStringOrNull(obj.title);
    if (!title) continue; // en deadline uden titel er ubrugelig
    deadlines.push({
      title,
      subject: toStringOrNull(obj.subject),
      dueDate: toStringOrNull(obj.dueDate),
      description: toStringOrNull(obj.description),
    });
  }

  return { ok: true, deadlines };
}
