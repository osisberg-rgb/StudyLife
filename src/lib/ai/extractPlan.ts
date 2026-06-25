// Orkestrering af AI-importen: læs den valgte fil som base64, byg content-blokke
// (billede eller PDF), kald modellen og parse svaret defensivt.
import * as FileSystem from 'expo-file-system/legacy';
import { callMessages, type ContentBlock } from './anthropic';
import { parseExtraction, type ParseResult } from './parse';
import { EXTRACTION_PROMPT } from './prompt';

export type PickedFileKind = 'image' | 'pdf';

export type PickedFile = {
  uri: string;
  kind: PickedFileKind;
  mimeType: string; // fx 'image/jpeg' eller 'application/pdf'
  name?: string;
};

function mediaBlock(file: PickedFile, base64: string): ContentBlock {
  if (file.kind === 'pdf') {
    return {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    };
  }
  // Anthropic understøtter jpeg/png/gif/webp. Default til jpeg hvis ukendt.
  const media = /^image\/(jpeg|png|gif|webp)$/.test(file.mimeType) ? file.mimeType : 'image/jpeg';
  return {
    type: 'image',
    source: { type: 'base64', media_type: media, data: base64 },
  };
}

/** Læs fil → kald model → parse. Returnerer ParseResult (kan være ok=false). */
export async function extractPlan(file: PickedFile): Promise<ParseResult> {
  const base64 = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const blocks: ContentBlock[] = [
    mediaBlock(file, base64),
    { type: 'text', text: EXTRACTION_PROMPT },
  ];

  const text = await callMessages(blocks);
  return parseExtraction(text);
}
