# StudyLife

Personlig studie-produktivitetsapp (V1). Du uploader din semesterplan/pensum
(billede eller PDF), en AI udtrækker alle deadlines, og appen laver dem til en
sporet liste med påmindelser. Oveni ligger en fokus-timer og studietid-statistik.

Lokal-først: ingen login, ingen betaling, ingen cloud-sync i V1.

## Tech

- Expo SDK 56 (React Native 0.85, React 19), TypeScript strict
- expo-router (fil-baseret routing, `src/app/`)
- Zustand (state), expo-sqlite (lokal DB)
- expo-notifications (lokale påmindelser pr. deadline)
- expo-image-picker / expo-document-picker (filinput)
- Anthropic Messages API (`claude-sonnet-4-6`) til plan-udtræk

## Kom i gang

```bash
# 1. Afhængigheder (allerede installeret)
npm install

# 2. API-nøgle: kopiér .env.example → .env og indsæt din Anthropic-nøgle
cp .env.example .env
#   sæt EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...

# 3. CocoaPods skal være installeret for at bygge til iOS.
#    System-Ruby er for gammel — installér via Homebrew:
brew install cocoapods

# 4. Byg + kør på tilsluttet iPhone (genererer ios/ via prebuild første gang)
npx expo run:ios --device
```

> Åbn alternativt det genererede `ios/StudyLife.xcworkspace` i Xcode efter
> første `npx expo run:ios` (eller `npx expo prebuild -p ios`), og kør derfra.

## Struktur

```
src/
  app/                  # expo-router skærme
    (tabs)/             # I dag · Deadlines · Fokus · Statistik
    import.tsx          # AI plan-import (modal)
    deadline/new.tsx    # opret deadline (modal)
    deadline/[id].tsx   # rediger deadline
    focus-session.tsx   # fuldskærms fokus-mode
  lib/
    db/                 # sqlite-klient, skema, migrationer, typede queries
    ai/                 # anthropic-klient + prompt + defensiv parser
    notifications/      # planlæg/aflys påmindelser
    dates.ts, stats.ts  # dato-hjælpere, afledt statistik/streaks
  store/                # zustand (settings, timer)
  components/           # genbrugs-UI
  types/                # domænetyper
```

## ⚠️ API-nøgle-sikkerhed (vigtigt før release)

Til lokal personlig brug ligger Anthropic-nøglen i `.env` (`EXPO_PUBLIC_…`) og
kaldet sker direkte fra appen. **En nøgle bundtet i appen kan udtrækkes af alle.**
Før du shipper til rigtige brugere skal kaldet flyttes bag en backend-proxy.
Se `// TODO: move behind backend proxy before release` i
`src/lib/ai/anthropic.ts`.

## Designvalg værd at kende

- **Datofelt:** Manuel deadline bruger tekstfelter (ÅÅÅÅ-MM-DD / TT:MM) i stedet
  for `@react-native-community/datetimepicker`, da V1-spec'en siger ingen nye
  native moduler. Kan opgraderes til en native picker senere.
- **Mappe-layout:** Spec'en viste `lib/`, `store/` i roden; SDK 56-skabelonen
  bruger `src/` med `@/*`-alias, så alt ligger under `src/`.
