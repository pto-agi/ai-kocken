# Intelligent Sammanfattning för Inlämningar (Design)

Date: 2026-03-02

## Summary
På `/intranet` under fliken "Inlämningar" presenteras startformulär och uppföljningar idag som omfattande fältlistor. Vi inför en intelligent, on-demand sammanfattning som gör varje inlämning snabb att förstå, med tydliga prioriteringar för coachens nästa steg. Lösningen ska använda OpenAI, vara kostnadseffektiv genom cache i databasen och alltid tillåta insyn i rådata.

## Goals
- Ge coachen en snabb, handlingsbar sammanfattning av varje inlämning.
- Minska tiden att läsa och tolka utspridd formulärdata.
- Behålla full transparens: rå inlämning ska alltid kunna öppnas.
- Köra sammanfattning on-demand för kontroll över kostnad och timing.
- Cachea resultat för snabb återvisning och färre API-anrop.

## Non-goals
- Ingen automatisk bakgrundsgenerering för alla inlämningar i detta steg.
- Ingen ersättning av den fullständiga formulärvyn.
- Ingen förändring av klientens formulärflöden (`/start`, `/uppfoljning`).

## Current State
- `pages/Intranet.tsx` renderar inlämningsdetaljer via `renderSubmissionDetails` i många `InfoRow`-fält.
- Översikten är funktionell men kognitivt tung: viktig information göms i långa sektioner.
- Ingen AI-sammanfattning eller strukturerad prioritering finns per inlämning.

## Proposed UX
1. Knapp per inlämning: `Intelligent sammanfattning`.
2. On-click:
- Om giltig cache finns: visa direkt.
- Annars: generera via API, visa loader i kortet.
3. Resultatpanel överst i kortet med sektioner:
- `Översikt`
- `Klientprofil`
- `Prioriterade coachåtgärder`
- `Riskflaggor`
- `Saknad information`
- `Fokus till nästa uppföljning`
4. Under panelen: `Visa full inlämning` (befintlig formulärdetalj i accordion).
5. Åtgärdsknappar:
- `Generera om`
- `Kopiera sammanfattning`

## Backend Design
Ny endpoint: `POST /api/submission-summary`

Input:
- `submissionType`: `start` | `uppfoljning`
- `submissionId`: string
- `payload`: normaliserad rådata från vald inlämning
- `language`: `sv` (default)
- `forceRefresh`: boolean (optional)

Output:
- Strikt JSON enligt schema:
  - `overview` (string)
  - `client_profile` (string)
  - `key_goals` (string[])
  - `risks_or_flags` (string[])
  - `coaching_actions` (string[])
  - `followup_focus` (string[])
  - `missing_info` (string[])
  - `confidence` (number 0..1)
  - `model` (string)
  - `generated_at` (iso string)

Promptprinciper:
- Faktabunden: hitta inte på data.
- Handlingsorienterad: ge konkreta nästa steg.
- Konsistent format: strikt JSON, inga markdown-svar.
- Svenskt språk i output.

## Caching + Invalidation
Ny tabell: `submission_summaries` (Supabase)
- `id uuid primary key`
- `submission_type text not null`
- `submission_id text not null`
- `source_hash text not null`
- `language text not null default 'sv'`
- `model text not null`
- `summary_json jsonb not null`
- `created_by uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique index på (`submission_type`, `submission_id`, `language`)

Invalidation:
- Hash beräknas från normaliserad payload.
- Cache hit endast om `source_hash` matchar.
- `forceRefresh=true` kringgår cache och uppdaterar posten.

## Security + Safety
- Endpoint kräver inloggad staff/manager (bearer token + profile check).
- Minimerad loggning: inga fulla fritextfält i serverloggar.
- Rate limit per användare för att undvika spam-anrop.
- Tydlig felhantering utan dataläckage i felmeddelanden.

## Error Handling
- 400: ogiltig payload.
- 401/403: ej behörig.
- 502: modell returnerar ogiltig JSON.
- 500: interna fel.
- UI visar återförsök och bibehåller rådetaljvyn även vid AI-fel.

## Testing Strategy
- Unit (utils):
  - payload-normalisering
  - hash-stabilitet
  - output-validering
- API:
  - cache hit
  - cache miss -> generate -> upsert
  - force refresh
  - modellfel/JSON-fel
- UI:
  - on-demand loading state
  - rendering av sammanfattningspanel
  - fallback vid fel

## Rollout
1. Lägg till SQL-migration för `submission_summaries`.
2. Bygg API endpoint med schema-validering.
3. Integrera UI i `Intranet.tsx` bakom feature flag (`ENABLE_SUBMISSION_SUMMARY`).
4. Kör test + full build.
5. Aktivera för intern pilot och justera prompt vid behov.

## Changelog impact
Ändringen förväntas ge en automatisk changelog-entry vid nästa push via befintlig GitHub Action (`scripts/update-changelog.mjs`).
