// Lavniveau-klient til Anthropic Messages API. Vi kalder REST-endpointet direkte
// med fetch — det passer React Native bedst og matcher den eksisterende
// flyer-udtræknings-pipeline (billede/PDF → struktureret data).
//
// TODO: flyt bag en backend-proxy før release. En API-nøgle bundtet i appen
// sendes til alle enheder og kan udtrækkes. Til lokal personlig brug er
// EXPO_PUBLIC_-env-varablen OK, men den må IKKE shippes til rigtige brugere.
// Læg Anthropic-kaldet bag fx en Expo API-route eller serverless-funktion.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Modellen er valgt bevidst i projektets spec (claude-sonnet-4-6): god til
// vision/dokument-udtræk til en lavere pris end Opus-klassen.
export const EXTRACTION_MODEL = 'claude-sonnet-4-6';

export type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
};

export type DocumentBlock = {
  type: 'document';
  source: { type: 'base64'; media_type: 'application/pdf'; data: string };
};

export type TextBlock = { type: 'text'; text: string };

export type ContentBlock = ImageBlock | DocumentBlock | TextBlock;

export function getApiKey(): string | null {
  return process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? null;
}

export class AnthropicError extends Error {}

/**
 * Send et enkelt bruger-turn (blanding af tekst/billede/PDF) og returnér modellens
 * samlede tekstoutput. Kaster AnthropicError ved manglende nøgle eller HTTP-fejl.
 */
export async function callMessages(
  blocks: ContentBlock[],
  opts: { maxTokens?: number } = {},
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AnthropicError(
      'Mangler API-nøgle. Sæt EXPO_PUBLIC_ANTHROPIC_API_KEY i din .env og genstart.',
    );
  }

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: EXTRACTION_MODEL,
        max_tokens: opts.maxTokens ?? 8192,
        messages: [{ role: 'user', content: blocks }],
      }),
    });
  } catch (e) {
    throw new AnthropicError(`Netværksfejl: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AnthropicError(`API-fejl ${res.status}: ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
  };

  // Saml al tekst fra svaret (ignorér evt. ikke-tekst-blokke).
  const text = (json.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');

  return text;
}
