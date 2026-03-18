import {
  readBody,
  isAllowedOrigin,
  setCors,
  escapeHtml,
  isEmptyValue,
  formatValue,
  validateApiSecret,
} from './_shared/apiHelpers.js';
import {
  sendResendEmail,
  buildBaseEmailLayout,
  getAppBaseUrl,
  parseRecipientList,
  dedupeRecipients,
  DEFAULT_FROM,
  DEFAULT_TO,
  type ResendPayload,
} from './_shared/emailHelpers.js';

type FormSource = 'startform' | 'uppfoljning' | 'forlangning' | 'refill' | 'registrering';

type SectionConfig = {
  title: string;
  keys: string[];
};

type EmailRow = {
  key: string;
  label: string;
  textValue: string;
  htmlValue: string;
};

type EmailSection = {
  title: string;
  rows: EmailRow[];
};

type UserConfirmationContent = {
  subject: string;
  title: string;
  subtitle: string;
  introText: string;
  detailText: string;
  outroText?: string;
  ctaLabel: string;
  ctaHref: string;
};

const SOURCE_LABEL: Record<FormSource, string> = {
  startform: 'Startformulär',
  uppfoljning: 'Uppföljning',
  forlangning: 'Förlängning',
  refill: 'Refill',
  registrering: 'Registrering',
};

const EMPTY_VALUE = '—';

const FIELD_LABELS: Record<string, string> = {
  submitted_at: 'Skickat',
  first_name: 'Förnamn',
  last_name: 'Efternamn',
  email: 'E-post',
  membership_level: 'Medlemsnivå',
  desired_start_date: 'Önskat startdatum',
  weight_kg: 'Vikt (kg)',
  height_cm: 'Längd (cm)',
  age: 'Ålder',
  focus_areas: 'Fokusområden',
  goal_description: 'Målbeskrivning',
  injuries: 'Skador/Begränsningar',
  training_experience: 'Träningserfarenhet',
  activity_last_6_months: 'Aktivitet senaste 6 månaderna',
  diet_last_6_months: 'Kost senaste 6 månaderna',
  training_forms: 'Träningsformer',
  training_forms_other: 'Träningsformer (annat)',
  training_places: 'Träningsplatser',
  training_places_other: 'Träningsplatser (annat)',
  sessions_per_week: 'Pass per vecka',
  sessions_per_week_other: 'Pass per vecka (annat)',
  measurement_chest_back: 'Mått bröst/rygg',
  measurement_arm_right: 'Mått arm höger',
  measurement_arm_left: 'Mått arm vänster',
  measurement_shoulders: 'Mått axlar',
  measurement_waist: 'Mått midja',
  measurement_thigh_right: 'Mått lår höger',
  measurement_thigh_left: 'Mått lår vänster',
  measurement_calf_right: 'Mått vad höger',
  measurement_calf_left: 'Mått vad vänster',
  quick_keep_plan: 'Behåll nuvarande upplägg',
  summary_feedback: 'Summering och feedback',
  goal: 'Mål',
  other_activity: 'Övrig aktivitet',
  home_equipment: 'Utrustning hemma',
  home_equipment_other: 'Utrustning hemma (annat)',
  current_expires_at: 'Nuvarande utgångsdatum',
  new_expires_at: 'Nytt utgångsdatum',
  billing_starts_at: 'Beräknat från',
  payment_method: 'Betalningsmetod',
  wellness_portal: 'Friskvårdsportal',
  months_extended: 'Antal månader förlängt',
  month_count: 'Månadsekvivalent',
  total_price: 'Pris (intern)',
  campaign_year: 'Kampanjår',
  item_count: 'Antal produkter',
  subtotal: 'Delsumma',
  total: 'Total',
  currency: 'Valuta',
  items: 'Produkter',
  created_at: 'Skapad',
  address_line1: 'Adressrad 1',
  address_line2: 'Adressrad 2',
  postal_code: 'Postnummer',
  city: 'Ort',
  country: 'Land',
  phone: 'Telefon',
  user_id: 'Användar-ID',
  registration_source: 'Källa',
};

const STARTFORM_SECTIONS: SectionConfig[] = [
  {
    title: 'Kontaktuppgifter',
    keys: ['submitted_at', 'first_name', 'last_name', 'email', 'desired_start_date'],
  },
  {
    title: 'Grunddata',
    keys: ['weight_kg', 'height_cm', 'age'],
  },
  {
    title: 'Fokus och mål',
    keys: ['focus_areas', 'goal_description'],
  },
  {
    title: 'Bakgrund',
    keys: ['injuries', 'training_experience', 'activity_last_6_months', 'diet_last_6_months'],
  },
  {
    title: 'Träningsupplägg',
    keys: [
      'training_forms',
      'training_forms_other',
      'training_places',
      'training_places_other',
      'home_equipment',
      'home_equipment_other',
      'sessions_per_week',
      'sessions_per_week_other',
    ],
  },
  {
    title: 'Kroppsmått',
    keys: [
      'measurement_chest_back',
      'measurement_arm_right',
      'measurement_arm_left',
      'measurement_shoulders',
      'measurement_waist',
      'measurement_thigh_right',
      'measurement_thigh_left',
      'measurement_calf_right',
      'measurement_calf_left',
    ],
  },
];

const UPPFOLJNING_SECTIONS: SectionConfig[] = [
  {
    title: 'Kontaktuppgifter',
    keys: ['submitted_at', 'first_name', 'last_name', 'email'],
  },
  {
    title: 'Snabbval',
    keys: ['quick_keep_plan', 'sessions_per_week', 'sessions_per_week_other', 'goal'],
  },
  {
    title: 'Feedback',
    keys: ['summary_feedback'],
  },
  {
    title: 'Träningsmiljö',
    keys: ['training_places', 'training_places_other', 'home_equipment', 'home_equipment_other', 'other_activity'],
  },
];

const FORLANGNING_SECTIONS: SectionConfig[] = [
  {
    title: 'Kontaktuppgifter',
    keys: ['submitted_at', 'first_name', 'last_name', 'email'],
  },
  {
    title: 'Förlängningsdetaljer',
    keys: ['current_expires_at', 'new_expires_at', 'billing_starts_at', 'months_extended'],
  },
  {
    title: 'Betalning',
    keys: ['payment_method', 'wellness_portal'],
  },
  {
    title: 'Intern data',
    keys: ['campaign_year', 'month_count', 'total_price'],
  },
];

const REFILL_SECTIONS: SectionConfig[] = [
  {
    title: 'Kontaktuppgifter',
    keys: ['submitted_at', 'first_name', 'last_name', 'email', 'membership_level'],
  },
  {
    title: 'Beställning',
    keys: ['created_at', 'item_count', 'subtotal', 'total', 'currency', 'items'],
  },
  {
    title: 'Leverans',
    keys: ['address_line1', 'address_line2', 'postal_code', 'city', 'country', 'phone'],
  },
];

const REGISTRERING_SECTIONS: SectionConfig[] = [
  {
    title: 'Kontaktuppgifter',
    keys: ['submitted_at', 'first_name', 'last_name', 'email'],
  },
  {
    title: 'System',
    keys: ['user_id', 'registration_source'],
  },
];

function toTitleCase(raw: string): string {
  return raw
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] || toTitleCase(key);
}

function getSectionConfig(source: FormSource): SectionConfig[] {
  if (source === 'startform') return STARTFORM_SECTIONS;
  if (source === 'uppfoljning') return UPPFOLJNING_SECTIONS;
  if (source === 'forlangning') return FORLANGNING_SECTIONS;
  if (source === 'refill') return REFILL_SECTIONS;
  return REGISTRERING_SECTIONS;
}

function getRecipientsForSource(source: FormSource): string[] {
  if (source === 'startform') {
    return dedupeRecipients([DEFAULT_TO, ...parseRecipientList(process.env.RESEND_FORM_TO)]);
  }
  return [DEFAULT_TO];
}

function getReplyToForSource(source: FormSource, payload: Record<string, unknown>): string | undefined {
  if (source === 'forlangning') return DEFAULT_TO;

  const email = payload.email;
  if (typeof email === 'string' && email.trim()) return email.trim();
  return undefined;
}

function buildRows(keys: string[], payload: Record<string, unknown>): EmailRow[] {
  return keys
    .filter((key) => !isEmptyValue(payload[key]))
    .map((key) => {
    const textValue = formatValue(payload[key]);
    return {
      key,
      label: getFieldLabel(key),
      textValue,
      htmlValue: escapeHtml(textValue),
    };
  });
}

function buildSections(source: FormSource, payload: Record<string, unknown>): EmailSection[] {
  const sections = getSectionConfig(source);
  const seen = new Set<string>();

  const knownSections: EmailSection[] = sections.map((section) => {
    section.keys.forEach((key) => seen.add(key));
    const rows = buildRows(section.keys, payload);
    return {
      title: section.title,
      rows,
    };
  }).filter((section) => section.rows.length > 0);

  const extraKeys = Object.keys(payload).filter((key) => key !== 'source' && !seen.has(key) && !isEmptyValue(payload[key]));
  if (extraKeys.length > 0) {
    knownSections.push({
      title: 'Övriga uppgifter',
      rows: buildRows(extraKeys, payload),
    });
  }

  return knownSections;
}

function buildEmailText(source: FormSource, sections: EmailSection[], fullName: string): string {
  const lines: string[] = [`${SOURCE_LABEL[source]} inskickat`, ''];

  if (fullName) {
    lines.push(`Namn: ${fullName}`);
    lines.push('');
  }

  for (const section of sections) {
    lines.push(`[${section.title}]`);
    section.rows.forEach((row) => {
      lines.push(`${row.label}: ${row.textValue}`);
    });
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildSectionRowsHtml(rows: EmailRow[]): string {
  return rows
    .map((row) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #ece7db;width:220px;color:#6B6158;font-size:12px;vertical-align:top;font-weight:700;letter-spacing:.03em;text-transform:uppercase;">${escapeHtml(row.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #ece7db;font-size:14px;color:#2A241F;line-height:1.5;word-break:break-word;">${row.htmlValue}</td>
      </tr>`)
    .join('');
}

function buildSectionsHtml(sections: EmailSection[]): string {
  return sections
    .map((section) => `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 18px;">
        <tr>
          <td style="padding:0 0 8px;">
            <h3 style="margin:0;font-size:15px;line-height:1.3;color:#3D3D3D;font-weight:800;letter-spacing:.02em;">${escapeHtml(section.title)}</h3>
          </td>
        </tr>
        <tr>
          <td>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;border:1px solid #E6E1D8;border-radius:12px;overflow:hidden;">
              ${buildSectionRowsHtml(section.rows)}
            </table>
          </td>
        </tr>
      </table>`)
    .join('');
}

function buildEmailHtml(source: FormSource, sections: EmailSection[], fullName: string, submittedAt: string): string {
  const label = SOURCE_LABEL[source];
  const summaryRows = [
    { label: 'Namn', value: fullName || EMPTY_VALUE },
    { label: 'Skickat', value: submittedAt },
  ];
  const summaryHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;border:1px solid #E6E1D8;border-radius:12px;overflow:hidden;margin:0 0 18px;">
      ${summaryRows.map((item) => `
        <tr>
          <td style="padding:10px 0 10px 12px;border-bottom:1px solid #ece7db;width:220px;color:#6B6158;font-size:12px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;">${escapeHtml(item.label)}</td>
          <td style="padding:10px 12px 10px 0;border-bottom:1px solid #ece7db;font-size:14px;color:#2A241F;line-height:1.5;">${escapeHtml(item.value)}</td>
        </tr>`).join('')}
    </table>
  `;
  const sectionsHtml = buildSectionsHtml(sections);

  return buildBaseEmailLayout({
    title: `${label} inkommet`,
    subtitle: 'Ny inlämning registrerad i medlemssystemet.',
    preheader: `${label} inkommet`,
    badge: 'PTO Inkommande',
    introHtml: '<strong>Inskickade uppgifter</strong>',
    bodyHtml: `${summaryHtml}${sectionsHtml}`,
    ctaLabel: 'Öppna intranätet',
    ctaHref: `${getAppBaseUrl()}/intranet`,
    footerNote: 'Detta mejl skickades automatiskt från formulärflödet.',
  });
}

function getUserConfirmationContent(source: FormSource): UserConfirmationContent {
  const appBaseUrl = getAppBaseUrl();
  if (source === 'startform') {
    return {
      subject: 'Tack för din inlämning!',
      title: 'Tack för din inlämning',
      subtitle: 'Din startinlämning är mottagen.',
      introText: 'Vi har mottagit din startinlämning och sätter igång med planeringsarbetet.',
      detailText: 'Om du har frågor eller vill komplettera med något kan du svara direkt på detta mejl.',
      outroText: 'Vi hörs vidare inom kort.',
      ctaLabel: 'Öppna Mina sidor',
      ctaHref: `${appBaseUrl}/profile/inlamningar`,
    };
  }
  if (source === 'forlangning') {
    return {
      subject: 'Tack för din förlängning!',
      title: 'Tack för din förlängning',
      subtitle: 'Din förlängning är mottagen.',
      introText: 'Vi har mottagit din förlängning och registrerar den i systemet.',
      detailText: 'Om något behöver kompletteras återkommer vi, annars är allt på plats.',
      outroText: 'Tack för att du fortsätter din resa med oss.',
      ctaLabel: 'Öppna Mina sidor',
      ctaHref: `${appBaseUrl}/profile`,
    };
  }
  if (source === 'refill') {
    return {
      subject: 'Tack för din refill-beställning!',
      title: 'Tack för din refill-beställning',
      subtitle: 'Din beställning är mottagen.',
      introText: 'Vi har mottagit din refill-beställning och hanterar den så snart som möjligt.',
      detailText: 'Om vi behöver kompletterande uppgifter hör vi av oss till dig.',
      outroText: 'Tack för att du handlar via medlemsshoppen.',
      ctaLabel: 'Öppna Mina sidor',
      ctaHref: `${appBaseUrl}/refill`,
    };
  }
  return {
    subject: 'Tack för din uppföljning!',
    title: 'Tack för din uppföljning',
    subtitle: 'Din uppföljning är mottagen.',
    introText: 'Vi har mottagit din uppföljning och går igenom den inför nästa planering.',
    detailText: 'Om du vill lägga till något är det bara att svara direkt på detta mejl.',
    outroText: 'Vi återkommer så snart nästa steg är klart.',
    ctaLabel: 'Öppna Mina sidor',
    ctaHref: `${appBaseUrl}/profile/inlamningar`,
  };
}

function shouldSendUserConfirmation(source: FormSource): boolean {
  return source !== 'registrering' && source !== 'startform';
}

function buildUserConfirmationText(source: FormSource, fullName: string): string {
  const content = getUserConfirmationContent(source);
  const greeting = fullName ? `Hej ${fullName},` : 'Hej,';
  const outroLine = content.outroText ? [content.outroText, ''] : [];
  return [
    greeting,
    '',
    content.introText,
    content.detailText,
    '',
    ...outroLine,
    'Vänliga hälsningar,',
    'Private Training Online',
  ].join('\n');
}

function buildUserConfirmationHtml(source: FormSource, fullName: string): string {
  const content = getUserConfirmationContent(source);
  const displayName = escapeHtml(fullName);
  const greeting = displayName ? `Hej ${displayName},` : 'Hej,';
  const outroParagraph = content.outroText
    ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#3D3D3D;">${escapeHtml(content.outroText)}</p>`
    : '';
  return buildBaseEmailLayout({
    title: content.title,
    subtitle: content.subtitle,
    preheader: content.subject,
    badge: 'PTO Bekräftelse',
    hideHero: true,
    introHtml: `
      <p style="margin:0 0 10px;"><strong>${greeting}</strong></p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#3D3D3D;">${escapeHtml(content.introText)}</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#3D3D3D;">${escapeHtml(content.detailText)}</p>
      ${outroParagraph}
      <p style="margin:0;font-size:14px;line-height:1.65;color:#3D3D3D;">Med vänliga hälsningar,<br />Private Training Online</p>
    `,
    bodyHtml: '',
    footerNote: 'Du kan svara direkt på detta mejl om du vill komplettera något.',
  });
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  if (!isAllowedOrigin(origin, 'FORM_NOTIFICATION_ALLOWED_ORIGINS')) {
    setCors(res, origin);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-secret');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!validateApiSecret(req)) {
    setCors(res, origin);
    res.status(403).json({ error: 'Invalid API secret' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    setCors(res, origin);
    res.status(500).json({ error: 'Missing RESEND_API_KEY' });
    return;
  }

  const body = await readBody(req);
  const source = body.source;
  if (source !== 'startform' && source !== 'uppfoljning' && source !== 'forlangning' && source !== 'refill' && source !== 'registrering') {
    setCors(res, origin);
    res.status(400).json({ error: 'Unsupported source' });
    return;
  }

  const from = (process.env.RESEND_FORM_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
  const to = getRecipientsForSource(source);
  const submittedAt = typeof body.submitted_at === 'string' ? body.submitted_at : new Date().toISOString();
  const firstName = typeof body.first_name === 'string' ? body.first_name.trim() : '';
  const lastName = typeof body.last_name === 'string' ? body.last_name.trim() : '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const label = SOURCE_LABEL[source];
  const subjectPrefix = fullName ? `${label}: ${fullName}` : `${label} inkommet`;
  const payload = {
    ...body,
    submitted_at: submittedAt,
  };

  const sections = buildSections(source, payload);
  const text = buildEmailText(source, sections, fullName);
  const html = buildEmailHtml(source, sections, fullName, submittedAt);

  const resendPayload: ResendPayload = {
    from,
    to,
    reply_to: getReplyToForSource(source, body),
    subject: subjectPrefix,
    text,
    html,
  };

  try {
    const adminData = await sendResendEmail(apiKey, resendPayload);
    let confirmationId: string | null = null;

    const userEmail = typeof body.email === 'string' ? body.email.trim() : '';
    if (userEmail && shouldSendUserConfirmation(source)) {
      const userContent = getUserConfirmationContent(source);
      const confirmationPayload: ResendPayload = {
        from,
        to: [userEmail],
        subject: userContent.subject,
        text: buildUserConfirmationText(source, fullName),
        html: buildUserConfirmationHtml(source, fullName),
        reply_to: DEFAULT_TO,
      };
      const confirmationData = await sendResendEmail(apiKey, confirmationPayload);
      confirmationId = confirmationData?.id || null;
    }

    setCors(res, origin);
    res.status(200).json({ ok: true, id: adminData?.id || null, channel: 'resend', confirmation_id: confirmationId });
  } catch (error: any) {
    console.error('Form notification error', error);
    setCors(res, origin);
    if (error?.status) {
      res.status(502).json({ error: 'Resend request failed', status: error.status, details: error.details || '' });
      return;
    }
    res.status(502).json({ error: 'Resend request failed' });
  }
}
