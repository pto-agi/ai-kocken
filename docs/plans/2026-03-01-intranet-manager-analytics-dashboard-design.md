# Intranet Manager Analytics Dashboard (Design)

Date: 2026-03-01

## Summary
Bygg om `/intranet/manager` från en ren dagsöversikt till ett analysverktyg med fokus på tidsavvikelser per uppgift, managerstyrd alarmering, historiska rapporter och samlad inlämningsanalys. Lösningen ska vara deterministisk (ingen AI), klickbar och användbar i daglig drift.

## Goals
- Visa skillnad i tid mellan uppgifter med tydliga deltavärden.
- Beräkna avvikelse mot `estimated_minutes` och klassificera nivå (`ok`, `warning`, `critical`).
- Låta manager överstyra om en uppgift är alarmerande eller ej.
- Samla historiska rapporter i en explorer med filter.
- Visa vilka inlämningar som kommit in och trender över valt intervall.
- Göra rubriker klickbara för förklaringar och drilldown.

## Non-goals
- Ändra personalens `/intranet`-upplevelse.
- Införa AI-analys i detta steg.
- Tvinga SQL-migrationer för att sidan ska rendera (override-lager är optional-first).

## Current State
- Manager-sidan har dagliga KPI-kort, personaldrilldown, rapporter och dagens inlämningar.
- Slow-flaggning baseras på en gemensam ankartid och fångar inte sekventiell avvikelse mellan uppgifter.
- Historik finns per person men ingen samlad analysvy över flera dagar med rankning av avvikelser.

## Proposed UX
1. Analysöversikt
- Tidsintervall: idag / 7 dagar / 30 dagar.
- KPI: utförda uppgifter, avvikande uppgifter, kritiska uppgifter, snittdelta, rapporttäckning.
- Klickbar rubrik med metodik/förklaring.

2. Avvikelseanalys (task delta)
- Tabell över uppgifter med:
  - person, datum, uppgift
  - estimerad tid
  - förväntad sluttid
  - faktisk sluttid
  - delta minuter
  - auto-nivå + managerbeslut
- Filter på nivå och personal.
- Klickbar rubrik med definitioner.

3. Historiska rapporter
- Samlad lista av rapporter inom valt spann.
- Filterbar och sorterad med snabbkontext (start/slut + utdrag).
- Klickbar rubrik som förklarar hur rapporttäckning mäts.

4. Inlämningsanalys
- Summering av startformulär + uppföljningar inom intervallet.
- Fördelning per typ och senaste inlämningar.
- Klickbar rubrik med detaljinfo.

5. Befintlig personaldrilldown kvar
- Behåll dagens operativa kort men komplettera med ny alarmbadging från analysmotorn.

## Analysis Model
- För varje användare och dag:
  - hämta schemalagda tasks i sorteringsordning.
  - sätt ankartid: `report.start_time` annars `08:00`.
  - beräkna `expected_completed_at` med kumulativ `estimated_minutes`.
  - `delta_minutes = actual_completed_at - expected_completed_at`.
- Auto severity:
  - `critical` om delta > 45 min
  - `warning` om delta > 15 min
  - `ok` annars
  - `missing` för ej klarmarkerade tasks på historiska dagar.
- Manager override:
  - manager kan sätta `is_alarming` true/false + reason.
  - final alarmstatus använder override när den finns.

## Data Changes (optional but recommended)
- Ny tabell: `agenda_manager_alert_overrides`.
- Om tabellen saknas ska dashboard fortfarande fungera med auto-analys och visa fallback (ingen persistens av override).

## Testing Strategy
- Enhetstesta analysberäkning:
  - expected time
  - delta/severity
  - missing-hantering
  - manager override prioritet
- Kör befintliga manager-tester + full `npm test`.
- Verifiera att `/changelog` sidan fortfarande renderas i build.

## Rollout
1. Lägg in analysutils + tester.
2. Integrera nya analyssektioner i manager-sidan.
3. Lägg till optional override persistence.
4. Kör full verifiering.
5. Kör SQL-migrationer samlat efter godkänd kod.
