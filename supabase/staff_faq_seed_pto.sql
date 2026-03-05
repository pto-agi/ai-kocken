-- Seed: PTO FAQ content from operations handbook
-- Safe to run multiple times (inserts only missing questions)

with src as (
  select * from (
    values
      (
        'Avslutas medlemskapet automatiskt?',
        'Ja. Vi har inga bindningstider eller uppsägningstider. När din förbetalda tid är slut väljer du själv om du vill förlänga. Om du inte aktivt förlänger avslutas medlemskapet automatiskt.',
        null,
        'Medlemskap & villkor',
        array['medlemskap','villkor','förlängning']::text[],
        null,
        null,
        true,
        100
      ),
      (
        'Kan jag pausa mitt medlemskap?',
        'Ja. Vid paus inaktiveras din tillgång till appen tillfälligt och återaktiveras när du är redo att starta igen.',
        'Pausa via länken.',
        'Medlemskap & villkor',
        array['paus','medlemskap','app']::text[],
        'Pausa medlemskap',
        'https://medlem.privatetrainingonline.se/paus/',
        true,
        110
      ),
      (
        'Kan jag ångra mitt medlemskap?',
        'Ja. Om du ångrar dig efter att du mottagit dina första upplägg är det okej. Vi krediterar/återbetalar alla återstående månader. Den första månaden återbetalas inte.',
        'Vid ärenden som rör ångerrätt, uppsägning eller returer: maila info@privatetrainingonline.se.',
        'Medlemskap & villkor',
        array['ångerrätt','uppsägning','retur','villkor']::text[],
        'Fullständiga villkor',
        'https://privatetrainingonline.se/villkor-info/',
        true,
        120
      ),
      (
        'Får jag behålla mina program efter att medlemskapet avslutats?',
        'När medlemskapet tar slut försvinner din tillgång till appen. Du kan spara ner dina upplägg som PDF via webbversionen innan din tid löper ut.',
        null,
        'Medlemskap & villkor',
        array['program','pdf','trainerize','medlemskap']::text[],
        'Trainerize webb',
        'https://privatetrainingonline.trainerize.com/',
        true,
        130
      ),
      (
        'Är appen på svenska?',
        'Menyer och knappar är på engelska. Coaching, träningsprogram, kostscheman och övningsbeskrivningar är på svenska.',
        'Vid osäkerhet om funktioner: guida klienten i chatten.',
        'App & träning',
        array['app','språk','svenska','engelska']::text[],
        null,
        null,
        false,
        200
      ),
      (
        'Hur kontaktar jag min coach i appen?',
        'I nedre högra hörnet finns en ikon med vår logotyp. Klicka där för att öppna meddelandefunktionen.',
        null,
        'App & träning',
        array['coach','app','meddelande','kontakt']::text[],
        null,
        null,
        true,
        210
      ),
      (
        'Hur ofta har vi avstämningar?',
        'Enklare avstämningar sker löpande cirka 1 gång per vecka samt en mer detaljerad uppföljning 1 gång per månad. I samband med månadsavstämningen byts även schemat ut.',
        null,
        'App & träning',
        array['avstämning','uppföljning','månad']::text[],
        null,
        null,
        false,
        220
      ),
      (
        'Varför har jag inte fått mitt nästa upplägg?',
        'Vanligaste orsaken är att vi saknar månadsavstämning.',
        'Be klienten skicka in uppföljning via länken så skapas nytt schema.',
        'App & träning',
        array['uppföljning','schema','upplägg']::text[],
        'Skicka uppföljning',
        'https://my.privatetrainingonline.se/uppfoljning/',
        true,
        230
      ),
      (
        'Hur registrerar jag min kroppsvikt?',
        'Gå till Calendar, välj aktuell dag och klicka Add Body Stats. Uppdaterad vikt lämnas även i månadsuppföljningen.',
        null,
        'App & träning',
        array['kroppsvikt','calendar','body stats']::text[],
        null,
        null,
        false,
        240
      ),
      (
        'Kan jag registrera egen träning utanför schemat?',
        'Ja. Lägg in passet Egen träning i kalendern och checka av det. Kommentera gärna vilken träning som gjorts.',
        null,
        'App & träning',
        array['egen träning','kalender','app']::text[],
        null,
        null,
        false,
        250
      ),
      (
        'Kan jag skriva ut mitt träningsprogram?',
        'Ja. Logga in på webbversionen från dator med samma e-post/lösenord som i appen.',
        'Program kan skrivas ut med övningar, instruktioner och registrerade vikter.',
        'App & träning',
        array['skriva ut','träningsprogram','trainerize','pdf']::text[],
        'Trainerize webb',
        'https://privatetrainingonline.trainerize.com/',
        false,
        260
      ),
      (
        'Hur fungerar kostschemat och portionsmodellen (P)?',
        'Kostschemat bygger på portionsmodellen där 1 P = 100 kcal. P fördelas mellan protein/kolhydrater/fett utifrån mål, aktivitet och kropp.',
        'Följ schemat genom egna måltider enligt P, fokus på dagskcal med recept eller registrering i extern app.',
        'Kost & recept',
        array['kostschema','portion','kcal','p-modell']::text[],
        null,
        null,
        false,
        300
      ),
      (
        'Har ni färdiga recept?',
        'Ja. Vi har receptbank och AI-receptgenerator för veckomeny.',
        null,
        'Kost & recept',
        array['recept','ai','veckomeny']::text[],
        'Receptbank',
        'https://medlem.privatetrainingonline.se/recept/',
        true,
        310
      ),
      (
        'Hur registrerar (trackar) jag det jag äter?',
        'Du kan använda externa appar som MyFitnessPal eller Lifesum.',
        'MyFitnessPal kan synkas. Lifesum synkar inte automatiskt, mat förs in manuellt i vår app.',
        'Kost & recept',
        array['tracking','myfitnesspal','lifesum','kost']::text[],
        null,
        null,
        false,
        320
      ),
      (
        'Måste jag köpa de rekommenderade kosttillskotten?',
        'Nej. Det är helt frivilligt. Upplägget fungerar lika bra utan tillskott.',
        null,
        'Kost & recept',
        array['kosttillskott','frivilligt']::text[],
        null,
        null,
        true,
        330
      ),
      (
        'Hur förlänger jag mitt medlemskap?',
        'Du förlänger via förlängningssidan.',
        null,
        'Förlängning',
        array['förlängning','medlemskap']::text[],
        'Förläng medlemskap',
        'https://medlem.privatetrainingonline.se/forlangning/',
        true,
        400
      ),
      (
        'Vad kostar en förlängning?',
        'Aktuella priser: 6 månader 1995 kr (ord. 3995 kr), 12 månader 2995 kr (ord. 7920 kr).',
        null,
        'Förlängning',
        array['pris','förlängning','6 månader','12 månader']::text[],
        null,
        null,
        true,
        410
      ),
      (
        'Vilka betalningsmetoder erbjuder ni?',
        'Faktura, Swish, delbetalning samt friskvårdsbidrag via kvitto eller friskvårdsportal.',
        null,
        'Betalning & friskvård',
        array['betalning','faktura','swish','delbetalning','friskvård']::text[],
        null,
        null,
        true,
        500
      ),
      (
        'Hur använder jag mitt friskvårdsbidrag hos er?',
        'Två sätt: via friskvårdsportal eller via kvitto.',
        'Via portal: sök Private Training Online och genomför köp där. Via kvitto: köp som vanligt och begär kvitto med inbetalningsdatum.',
        'Betalning & friskvård',
        array['friskvård','kvitto','portal']::text[],
        null,
        null,
        true,
        510
      ),
      (
        'Vilka friskvårdsportaler är ni anslutna till?',
        'Epassi, Benify, Benifex, Edenred, Benefits, Söderberg & Partners och Wellnet. Edenred hanteras via särskild kortbetalningslänk.',
        null,
        'Betalning & friskvård',
        array['epassi','benify','edenred','wellnet','friskvård']::text[],
        null,
        null,
        true,
        520
      ),
      (
        'Jag vill delbetala mitt köp – går det?',
        'Ja. Vi samarbetar med Svea där kunden kan välja antal månader och hantera betalningen flexibelt.',
        'Om delbetalning aktiveras makuleras fakturan.',
        'Betalning & friskvård',
        array['delbetalning','svea','faktura']::text[],
        null,
        null,
        false,
        530
      ),
      (
        'Jag vill betala med Swish – hur gör jag?',
        'Swisha beloppet till 1230037317 (123 003 73 17). Märk gärna med namn. Om annan persons nummer används: skriv kundens namn i meddelandet.',
        null,
        'Betalning & friskvård',
        array['swish','betalning','1230037317']::text[],
        null,
        null,
        true,
        540
      ),
      (
        'Hur betalar jag med Benify?',
        'Öppna Benify-portalen/appen, sök Private Training Online och genomför köpet där.',
        'Vi kan inte lägga upp betalningar manuellt i Benify.',
        'Betalning & friskvård',
        array['benify','friskvård','betalning']::text[],
        null,
        null,
        false,
        550
      ),
      (
        'Hur betalar jag med Epassi?',
        'Öppna Epassi-portalen/appen, sök Private Training Online och genomför köpet där.',
        'Vi kan inte lägga upp betalningar manuellt i Epassi.',
        'Betalning & friskvård',
        array['epassi','friskvård','betalning']::text[],
        null,
        null,
        false,
        560
      ),
      (
        'Kan jag betala en del via Epassi och resten privat?',
        'Ja. I Epassi kan kunden välja eget belopp. Vi skickar faktura på mellanskillnaden utan extra kostnad.',
        null,
        'Betalning & friskvård',
        array['epassi','mellanskillnad','faktura']::text[],
        null,
        null,
        false,
        570
      ),
      (
        'Hur betalar jag med Wellnet?',
        'Öppna Wellnet-portalen/appen, sök Private Training Online och genomför köpet där.',
        'Vi kan inte lägga upp betalningar manuellt i Wellnet.',
        'Betalning & friskvård',
        array['wellnet','friskvård','betalning']::text[],
        null,
        null,
        false,
        580
      ),
      (
        'Hur betalar jag med Edenred?',
        'Vi behöver lägga upp en kortbetalningslänk så kunden kan betala med Edenred-kort.',
        'Kontakta oss så skickar vi länken via e-post.',
        'Betalning & friskvård',
        array['edenred','kortbetalning','friskvård']::text[],
        null,
        null,
        true,
        590
      ),
      (
        'Har ni medlemspriser på kosttillskott?',
        'Ja. Klienter kan fylla på med kosttillskott till medlemspriser.',
        null,
        'Shop & leverans',
        array['shop','medlemspriser','kosttillskott']::text[],
        null,
        null,
        false,
        600
      ),
      (
        'Vad kostar frakten?',
        'Under 500 kr: frakt 39 kr. Över 500 kr: fri frakt.',
        null,
        'Shop & leverans',
        array['frakt','leverans','500 kr']::text[],
        null,
        null,
        true,
        610
      ),
      (
        'När kommer mitt paket? Hur lång är leveranstiden?',
        'Normal leveranstid är 2–5 arbetsdagar. Om spårningsinfo saknas kan vi mejla den.',
        null,
        'Shop & leverans',
        array['leveranstid','paket','spårning']::text[],
        null,
        null,
        true,
        620
      ),
      (
        'Vart kommer mitt paket?',
        'Leverans sker till närmsta ombud. Avisering skickas via e-post eller SMS.',
        null,
        'Shop & leverans',
        array['ombud','avisering','sms','paket']::text[],
        null,
        null,
        false,
        630
      ),
      (
        'Jag vill returnera hela eller delar av mitt paket – hur gör jag?',
        'Skicka paketet till Private Training Online, Ekholmsnäsvägen 44, 181 41 Lidingö och maila info@privatetrainingonline.se så returen kan registreras.',
        null,
        'Shop & leverans',
        array['retur','paket','adress']::text[],
        null,
        null,
        true,
        640
      ),
      (
        'Vad händer om jag inte hämtar ut mitt paket?',
        'Vid outlöst paket debiteras 195 kr inklusive moms för frakt och returhantering.',
        null,
        'Shop & leverans',
        array['outlöst','paket','avgift','195']::text[],
        null,
        null,
        true,
        650
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
