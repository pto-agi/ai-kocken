-- Seed: Missing staff-relevant FAQ from Knowledge/Lathund files
-- Idempotent: inserts only when question does not already exist

with src as (
  select * from (
    values
      (
        'När får kunden access till appen?',
        'Kunden får tillgång till appen när första uppläggen är färdiga. Innan dess går det normalt inte att logga in.',
        'Bekräfta att inbjudan skickas via e-post när första upplägget är klart.',
        'App & träning',
        array['app','inloggning','inbjudan','access']::text[],
        null,
        null,
        true,
        700
      ),
      (
        'Hur fungerar AI-receptgeneratorn?',
        'AI-receptgeneratorn används för att skapa veckomeny utifrån kalorimål och preferenser.',
        'Be kunden matcha kalorierna mot sitt kostschema. Veckomenyn kan skrivas ut från högra hörnet i verktyget.',
        'Kost & recept',
        array['ai','receptgenerator','veckomeny','kcal']::text[],
        'AI-receptgenerator',
        'https://ai.privatetrainingonline.se/',
        true,
        710
      ),
      (
        'Hur görs startupplägg och ny klient?',
        'Starta i startinlämningar, kontrollera startdatum och bygg klientens profil, träningsupplägg och kostschema enligt inlämningen.',
        '1) Öppna startinlämning. 2) Skapa profil i appen. 3) Leverera schema och anpassa kalender/övningar. 4) Skapa kostschema och ställ in goals. 5) Uppdatera slutdatum i klientdokument. 6) Skicka bekräftelse till klienten.',
        'Intern process',
        array['startupplägg','ny klient','startinlämning','intern rutin']::text[],
        null,
        null,
        false,
        720
      ),
      (
        'Hur görs uppföljningsupplägg?',
        'Läs uppföljningen och appkommentarer, välj lämpligt schema och kvalitetssäkra i kalendern.',
        '1) Öppna uppföljning. 2) Läs kommentarer i app. 3) Justera pass/övningar efter input. 4) Kontrollera att leveransen ser korrekt ut i kalendern.',
        'Intern process',
        array['uppföljning','uppföljningsupplägg','schema','intern rutin']::text[],
        null,
        null,
        false,
        730
      ),
      (
        'Hur hanteras förlängning av medlemskap internt?',
        'Förlängning registreras i sales/todo, slutdatum flyttas fram och klientdokument uppdateras.',
        'Addera köpta månader på utgångsdatum, flytta slutmeddelande och uppdatera klientdokument med ny sluttid.',
        'Intern process',
        array['förlängning','intern process','utgångsdatum']::text[],
        null,
        null,
        false,
        740
      ),
      (
        'Hur pausas medlemskap internt?',
        'Paus registreras i klientprofil med startdatum och påverkar senare utgångsdatum.',
        'Sätt pausdatum, flytta/deaktivera enligt rutin, och vid återaktivering adderas paustiden till medlemskapet samt nytt slutmeddelande schemaläggs.',
        'Intern process',
        array['paus','återaktivering','medlemskap','intern rutin']::text[],
        null,
        null,
        false,
        750
      ),
      (
        'Hur avslutas medlemskap internt?',
        'Konto deaktiveras i appen och klient hanteras i client-files enligt återstående tid och status.',
        'Om klienten har tid kvar: planera deaktiveringsdatum i todo. Om uppsägning omfattas av ångerrätt/retur: hantera via support.',
        'Intern process',
        array['avslut','deaktivera','client-files','intern rutin']::text[],
        null,
        null,
        false,
        760
      ),
      (
        'Hur hanteras utgångsdatum internt?',
        'Utgångsdatum följs upp löpande och klient deaktiveras när sista meddelande skickats och ingen förlängning skett inom rutinens tidsfönster.',
        'Stäm av klientdokument och slutmeddelanden. Lägg ärenden i deaktivera-flödet och flytta fram datum om kunden förlänger.',
        'Intern process',
        array['utgångsdatum','deaktivera','klienthantering']::text[],
        null,
        null,
        false,
        770
      ),
      (
        'Hur hanteras Activity Log i appen?',
        'Activity Log används för att fånga kommentarer och frågor från klienter.',
        'Öppna dashboard sidebar, filtrera på Comments Only och besvara kommentarer löpande.',
        'Intern process',
        array['activity log','comments only','app','intern rutin']::text[],
        null,
        null,
        false,
        780
      ),
      (
        'Hur ser veckorutinen för klienthantering ut?',
        'Rutinen omfattar todo-uppföljning, konversationskontroll, utgångsdatum, röda taggar och lead-uppföljning.',
        'Gå igenom deaktiveringsärenden, kontrollera slutmeddelanden, verifiera client-files/utgångsdatum och följ upp leads/röda taggar.',
        'Intern process',
        array['veckorutin','klienthantering','todo','leads']::text[],
        null,
        null,
        false,
        790
      ),
      (
        'Hur reklamerar kunden en felaktig eller defekt vara?',
        'Kunden kontaktar support med ordernummer och orsak. Vid godkänd reklamation skickas ersättningsvara eller återbetalning.',
        'Om ersättningsvara finns i lager skickas ny utan extra frakt. För retur av defekt vara skickas fraktsedel med betalt porto.',
        'Villkor & juridik',
        array['reklamation','defekt vara','ordernummer','retur']::text[],
        null,
        null,
        true,
        800
      ),
      (
        'Vilka supporttider och svarstider gäller?',
        'Support hanteras vardagar. Normalt svar inom 24 timmar, men i undantagsfall upp till 72 timmar.',
        'Personal är normalt ledig lördag/söndag och större helgdagar.',
        'Villkor & juridik',
        array['support','svarstid','öppettider','vardagar']::text[],
        null,
        null,
        true,
        810
      ),
      (
        'Hur fungerar ångerrättens första månad i praktiken?',
        'Vid ångerrätt återbetalas återstående månader, medan första månaden normalt inte återbetalas efter leverans av första upplägg.',
        'Skicka ärenden om ångerrätt/uppsägning/retur till info@privatetrainingonline.se för formell hantering.',
        'Villkor & juridik',
        array['ångerrätt','uppsägning','återbetalning','villkor']::text[],
        'Villkor',
        'https://privatetrainingonline.se/villkor-info/',
        true,
        820
      ),
      (
        'Var hittar personalen snabblänkar till formulär och shop?',
        'Här finns direktlänkar till vanliga flöden för support och onboarding.',
        'Startformulär: https://my.privatetrainingonline.se/start/ | Uppföljning: https://my.privatetrainingonline.se/uppfoljning/ | Webshop: https://shop.privatetrainingonline.se/',
        'Snabblänkar',
        array['startformulär','uppföljning','webshop','snabblänk']::text[],
        'Startformulär',
        'https://my.privatetrainingonline.se/start/',
        true,
        830
      )
  ) as t(question, answer, how_to, category, tags, link_label, link_href, show_on_intranet, sort_order)
)
insert into public.staff_faq_entries (
  question,
  answer,
  how_to,
  category,
  tags,
  link_label,
  link_href,
  show_on_intranet,
  sort_order
)
select
  src.question,
  src.answer,
  src.how_to,
  src.category,
  src.tags,
  src.link_label,
  src.link_href,
  src.show_on_intranet,
  src.sort_order
from src
where not exists (
  select 1
  from public.staff_faq_entries existing
  where lower(existing.question) = lower(src.question)
);
