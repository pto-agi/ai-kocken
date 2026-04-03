# PTO Design System — Migration Reference

> Referensdokument för att migrera flöden från WordPress (privatetrainingonline.se) till myPTO.
> Mål: Enhetlig, friktionsfri upplevelse som matchar den historiskt beprövade WP-sajten.

---

## Grundsetup (från WP-sajten)

| Token            | Värde      | Användning                        |
|------------------|------------|-----------------------------------|
| **Sidbredd**     | `1200px`   | Max container-width               |
| **Innehållskolumn** | `3/4` (≈900px) | Huvudinnehåll (Fusion Builder `type="3_4"`) |
| **Spacing left** | `2%`       | Vänstermarginal på kolumnen       |
| **Margin top**   | `20px`     | Toppmarginal                      |

---

## Typografi

### Rubriker

| Element | Typsnitt           | Vikt | Storlek | Radavstånd | Teckenavstånd | Transform   | Färg      |
|---------|--------------------|------|---------|------------|---------------|-------------|-----------|
| **H1**  | Barlow Condensed   | 700  | 48px    | 1 (=48px)  | -1px          | `uppercase` | `#3D3D3D` |
| **H2**  | Barlow Condensed   | 700  | 22px    | —          | —             | `uppercase` | `#3D3D3D` |
| **H3**  | Barlow Condensed   | 700  | 18px    | —          | —             | `uppercase` | `#3D3D3D` |

### Brödtext

| Element      | Typsnitt  | Vikt | Storlek | Färg      |
|--------------|-----------|------|---------|-----------|
| **Body**     | Open Sans | 400  | 16px    | `#3C4043` |
| **Subtext**  | Open Sans | 400  | 14px    | `#6B6158` |
| **Caption**  | Open Sans | 600  | 10–12px | `#8A8177` |

---

## Färger

| Namn            | Hex       | Användning                              |
|-----------------|-----------|------------------------------------------|
| **Rubrik**      | `#3D3D3D` | Rubriker, starka texter                  |
| **Brödtext**    | `#3C4043` | Paragraftext                             |
| **Subtext**     | `#6B6158` | Sekundär text, beskrivningar             |
| **Muted**       | `#8A8177` | Captions, labels, timestamps             |
| **Brand/CTA**   | `#a0c81d` | Knappar, checkmarks, accent              |
| **Brand hover** | `#8fb015` | Knapp hover-state                        |
| **Background**  | `#F6F1E7` | Sidans bakgrund (gradient start)         |
| **Card bg**     | `#FFFFFF` | Formulärkort, paneler                    |
| **Card border** | `#DDD8CD` | Yttre kort-border                        |
| **Input border**| `#3D3D3D` | Formulärfält-borders                     |
| **Divider**     | `#3D3D3D` | Sektionsavdelare                         |

---

## Formulär & Checkout

| Egenskap         | Värde                                    |
|------------------|------------------------------------------|
| **Border radius**| `12px` (inputs), `16px` (kort)           |
| **Input padding**| `12px 14px`                              |
| **Focus ring**   | `#a0c81d` med 1px boxShadow             |
| **Placeholder**  | `#C5BFB5`                                |
| **Error color**  | `#df1b41`                                |
| **Betalning**    | Stripe Elements (flat theme)             |

---

## Layout — Bli-klient-sidan

Enkolumns-layout, centrerad, som matchar WP-sidans `3/4`-kolumn:

```
┌──────────────────────────────────────────┐
│              PÅSKKAMPANJ (H1)            │
│     Brödtext + kampanjdeadline           │
│     Brödtext + coachkontakt              │
│                                          │
│     ✓ Checklista (trust bullets)         │
│                                          │
├──────────────────────────────────────────┤
│           KOM IGÅNG (H2)                 │
│     ┌──────────────────────────────┐     │
│     │  E-post                      │     │
│     │  Namn                        │     │
│     │  Paketval                    │     │
│     │  Betalningsmetod             │     │
│     │  [GÅ VIDARE →]              │     │
│     └──────────────────────────────┘     │
│     🔒 Säker betalning · Stripe          │
└──────────────────────────────────────────┘
```

**Max-width:** `680px` (optimerat för mobil + desktop läsbarhet)

---

## Trust Bullets (Checklista)

Behåll dessa kärnpåståenden — de har konverterat historiskt:

1. Över 30 000 nöjda klienter sedan 2012.
2. Priset gäller för hela perioden.
3. Inga månadsavgifter eller bindningstider.
4. Träna hemma, utomhus eller på gym.
5. 14 dagars ångerrätt.
6. Godkänt för friskvårdsbidrag.

---

## Google Fonts — Laddade typsnitt

```html
Barlow Condensed: 400, 500, 600, 700
Open Sans: 300, 400, 500, 600, 700
Poppins: 400, 500, 600, 700
Space Grotesk: 400, 500, 600, 700
```

---

## Migrationsnoteringar

- **WordPress-redirects**: Konfigurera 301 från `privatetrainingonline.se/bli-klient/` → `my.privatetrainingonline.se/bli-klient`
- **Google Ads**: Uppdatera konverteringsmål till ny URL
- **GA4 tracking**: `begin_checkout`, `add_payment_info`, `purchase` events implementerade
- **Stripe-planer**: Använder befintliga Stripe price IDs (se `checkoutPlans.ts`)
- **Kampanjhantering**: `CAMPAIGN`-objekt i `BliKlient.tsx` — uppdatera `name`, `deadlineLabel`, `deadline`
