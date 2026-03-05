type FormSource = 'startform' | 'uppfoljning' | 'forlangning';

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

const SOURCE_LABEL: Record<FormSource, string> = {
  startform: 'Startformulär',
  uppfoljning: 'Uppföljning',
  forlangning: 'Förlängning',
};

const RESEND_API_URL = 'https://api.resend.com/emails';
const EMPTY_VALUE = '—';
const DEFAULT_FROM = 'onboarding@resend.dev';
const DEFAULT_TO = 'info@privatetrainingonline.se';

const FIELD_LABELS: Record<string, string> = {
  submitted_at: 'Skickat',
  first_name: 'Förnamn',
  last_name: 'Efternamn',
  email: 'E-post',
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

type ResendPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to?: string;
};

async function readBody(req: any): Promise<Record<string, unknown>> {
  if (req?.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }

  const chunks: Buffer[] = [];
  if (req && req.readable) {
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  }

  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};

  const contentType = String(req?.headers?.['content-type'] || '');
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const allowed = (process.env.FORM_NOTIFICATION_ALLOWED_ORIGINS || process.env.CHAT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(origin);
}

function setCors(res: any, origin: string | undefined) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function formatValue(value: unknown): string {
  if (isEmptyValue(value)) return EMPTY_VALUE;
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nej';
  if (Array.isArray(value)) return value.length ? value.join(', ') : EMPTY_VALUE;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

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
  return FORLANGNING_SECTIONS;
}

function getRecipientsForSource(source: FormSource): string[] {
  if (source === 'forlangning' || source === 'uppfoljning') return [DEFAULT_TO];
  return parseRecipientList(process.env.RESEND_FORM_TO, DEFAULT_TO);
}

function getReplyToForSource(source: FormSource, payload: Record<string, unknown>): string | undefined {
  if (source === 'forlangning') return DEFAULT_TO;

  const email = payload.email;
  if (typeof email === 'string' && email.trim()) return email.trim();
  return undefined;
}

function parseRecipientList(raw: string | undefined, fallback: string): string[] {
  const list = (raw || fallback)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (list.length > 0) return list;
  return [fallback];
}

async function sendResendEmail(apiKey: string, payload: ResendPayload): Promise<{ id?: string | null }> {
  const upstream = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok) {
    const details = await upstream.text().catch(() => '');
    const err: any = new Error('Resend request failed');
    err.status = upstream.status;
    err.details = details;
    throw err;
  }

  return await upstream.json().catch(() => ({}));
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
        <td style="padding:10px 0;border-bottom:1px solid #eef2f7;width:230px;color:#64748b;font-size:13px;vertical-align:top;">${escapeHtml(row.label)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #eef2f7;font-size:14px;color:#111827;line-height:1.45;word-break:break-word;">${row.htmlValue}</td>
      </tr>`)
    .join('');
}

function buildEmailHtml(source: FormSource, sections: EmailSection[], fullName: string, submittedAt: string): string {
  const label = SOURCE_LABEL[source];
  const escapedFullName = escapeHtml(fullName || EMPTY_VALUE);
  const escapedSubmittedAt = escapeHtml(submittedAt);

  const sectionsHtml = sections
    .map((section) => `
      <tr>
        <td style="padding:0 24px 20px;">
          <h3 style="margin:0 0 8px;font-size:15px;color:#0f172a;">${escapeHtml(section.title)}</h3>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            ${buildSectionRowsHtml(section.rows)}
          </table>
        </td>
      </tr>`)
    .join('');

  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(label)} inkommet</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:760px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#ffffff;">
                <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Privatetrainingonline</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">${escapeHtml(label)} inkommet</h1>
                <p style="margin:8px 0 0;font-size:14px;opacity:.95;">Skickat: ${escapedSubmittedAt}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px 6px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid #eef2f7;width:230px;color:#64748b;font-size:13px;">Namn</td>
                    <td style="padding:8px 0;border-bottom:1px solid #eef2f7;font-size:14px;font-weight:600;color:#111827;">${escapedFullName}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 24px 14px;">
                <h2 style="margin:0;font-size:16px;color:#0f172a;">Inskickade uppgifter</h2>
              </td>
            </tr>
            ${sectionsHtml}
            <tr>
              <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;">
                Detta mejl skickades automatiskt från formulärflödet.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildUppfoljningConfirmationText(fullName: string): string {
  const displayName = fullName || 'hej';
  return [
    `Tack ${displayName}!`,
    '',
    'Vi har mottagit din uppföljning.',
    'Vårt team går igenom ditt underlag och använder det i planeringen av ditt nästa upplägg.',
    '',
    'Vänliga hälsningar,',
    'Private Training Online',
  ].join('\n');
}

function buildUppfoljningConfirmationHtml(fullName: string): string {
  const displayName = escapeHtml(fullName || 'hej');
  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vi har mottagit din uppföljning</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#ffffff;">
                <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">Privatetrainingonline</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">Vi har mottagit din uppföljning</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:16px;color:#0f172a;"><strong>Tack ${displayName}!</strong></p>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155;">
                  Din uppföljning är nu registrerad hos oss.
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
                  Vårt team går igenom ditt underlag och använder det i planeringen av ditt nästa upplägg.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;">
                Vänliga hälsningar,<br/>Private Training Online
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin as string | undefined;

  if (!isAllowedOrigin(origin)) {
    setCors(res, origin);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
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
  if (source !== 'startform' && source !== 'uppfoljning' && source !== 'forlangning') {
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

    if (source === 'uppfoljning') {
      const userEmail = typeof body.email === 'string' ? body.email.trim() : '';
      if (userEmail) {
        const confirmationPayload: ResendPayload = {
          from,
          to: [userEmail],
          subject: 'Vi har mottagit din uppföljning',
          text: buildUppfoljningConfirmationText(fullName),
          html: buildUppfoljningConfirmationHtml(fullName),
        };
        const confirmationData = await sendResendEmail(apiKey, confirmationPayload);
        confirmationId = confirmationData?.id || null;
      }
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
