// Palet til fag-pills. Vælges deterministisk ud fra fagets navn, så det samme
// fag altid får samme farve — også for AI-importerede fag uden gemt farve endnu.

export const SubjectColors = [
  '#208AEF', // blå
  '#E5484D', // rød
  '#30A46C', // grøn
  '#F76808', // orange
  '#8E4EC6', // lilla
  '#E54666', // pink
  '#0D9488', // teal
  '#D29404', // gul
  '#3E63DD', // indigo
  '#5C7C2F', // oliven
] as const;

/** Stabil farve for et fagnavn (samme navn → samme farve). */
export function colorForSubjectName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % SubjectColors.length;
  return SubjectColors[index];
}
