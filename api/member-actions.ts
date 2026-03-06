type MemberAction = 'pause_membership' | 'deactivate_membership' | 'reactivate_membership';

type ResendPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to?: string;
};

type CustomerContent = {
  subject: string;
  title: string;
  subtitle: string;
  introText: string;
  detailText: string;
  outroText: string;
  ctaLabel: string;
  ctaHref: string;
};

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'onboarding@resend.dev';
const DEFAULT_TO = 'info@privatetrainingonline.se';
const DEFAULT_APP_BASE_URL = 'https://my.privatetrainingonline.se';
const DEFAULT_LOGO_PATH = '/pto-logotyp-2026.png';

const ACTION_LABELS: Record<MemberAction, string> = {
  pause_membership: 'Paus av medlemskap',
  deactivate_membership: 'Avslut av medlemskap',
  reactivate_membership: 'Återaktivering av medlemskap',
};

const ACTION_FIELD_LABELS: Record<string, string> = {
  request_id: 'Begäran-ID',
  requested_at: 'Skickat',
  user_id: 'Användar-ID',
  name: 'Namn',
  email: 'E-post',
  membership_level: 'Medlemsnivå',
  source: 'Källa',
  coaching_expires_at: 'Nuvarande utgångsdatum',
};

function getActionWebhooks(): Record<MemberAction, string> {
  return {
    pause_membership: process.env.ZAPIER_PAUSE_WEBHOOK_URL || '',
    deactivate_membership: process.env.ZAPIER_DEACTIVATE_WEBHOOK_URL || '',
    reactivate_membership: process.env.ZAPIER_REACTIVATE_WEBHOOK_URL || '',
  };
}

function parseRecipientList(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dedupeRecipients(recipients: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  recipients.forEach((recipient) => {
    const normalized = recipient.trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(normalized);
  });
  return output;
}

function getActionRecipients(): string[] {
  return dedupeRecipients([DEFAULT_TO, ...parseRecipientList(process.env.RESEND_MEMBER_ACTION_TO)]);
}

function getAppBaseUrl(): string {
  return (process.env.MAIL_APP_BASE_URL || process.env.PUBLIC_APP_URL || DEFAULT_APP_BASE_URL).trim().replace(/\/+$/, '');
}

function getBrandLogoUrl(): string {
  const configured = (process.env.MAIL_LOGO_URL || '').trim();
  if (configured) return configured;
  return `${getAppBaseUrl()}${DEFAULT_LOGO_PATH}`;
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
  if (isEmptyValue(value)) return '—';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nej';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getFieldLabel(key: string): string {
  return ACTION_FIELD_LABELS[key] || key;
}

function buildBaseEmailLayout(params: {
  title: string;
  subtitle?: string;
  preheader?: string;
  badge?: string;
  introHtml?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaHref?: string;
  footerNote?: string;
}): string {
  const appBaseUrl = getAppBaseUrl();
  const logoUrl = getBrandLogoUrl();
  const preheader = escapeHtml(params.preheader || params.title);
  const title = escapeHtml(params.title);
  const subtitle = params.subtitle ? escapeHtml(params.subtitle) : '';
  const badge = escapeHtml(params.badge || 'Private Training Online');
  const footerNote = escapeHtml(params.footerNote || 'Detta mejl skickades automatiskt från medlemssystemet.');
  const ctaBlock = params.ctaLabel && params.ctaHref
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 0;">
        <tr>
          <td style="border-radius:12px;background:#a0c81d;">
            <a href="${escapeHtml(params.ctaHref)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 18px;color:#2A241F;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;">${escapeHtml(params.ctaLabel)}</a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#F6F1E7;font-family:'Helvetica Neue',Arial,sans-serif;color:#2A241F;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F1E7;padding:24px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #E6E1D8;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:18px 24px;background:#3D3D3D;border-bottom:3px solid #a0c81d;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${escapeHtml(logoUrl)}" alt="PTO" width="34" height="34" style="display:block;border:0;outline:none;text-decoration:none;" />
                    </td>
                    <td style="padding-left:10px;vertical-align:middle;">
                      <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#E6E1D8;font-weight:700;">${badge}</div>
                    </td>
                    <td align="right" style="vertical-align:middle;">
                      <a href="${escapeHtml(appBaseUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a0c81d;text-decoration:none;">Öppna appen</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px 8px;background:#fff;">
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#2A241F;font-weight:900;">${title}</h1>
                ${subtitle ? `<p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#6B6158;">${subtitle}</p>` : ''}
                ${params.introHtml ? `<div style="margin:14px 0 0;font-size:14px;line-height:1.65;color:#3D3D3D;">${params.introHtml}</div>` : ''}
                ${ctaBlock}
              </td>
            </tr>
            <tr>
              <td style="padding:10px 24px 18px;">
                <div style="background:#F6F1E7;border:1px solid #E6E1D8;border-radius:14px;padding:16px;">
                  ${params.bodyHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;background:#F4F0E6;border-top:1px solid #E6E1D8;color:#6B6158;font-size:12px;line-height:1.5;">
                ${footerNote}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildActionRows(payload: Record<string, unknown>): Array<{ label: string; value: string }> {
  const preferredKeys = [
    'requested_at',
    'name',
    'email',
    'membership_level',
    'coaching_expires_at',
    'request_id',
    'user_id',
    'source',
  ];
  const known = new Set(preferredKeys);
  const keys = [
    ...preferredKeys,
    ...Object.keys(payload).filter((key) => !known.has(key)),
  ];

  return keys
    .filter((key) => !isEmptyValue(payload[key]))
    .map((key) => ({
      label: getFieldLabel(key),
      value: formatValue(payload[key]),
    }));
}

function buildRowsText(rows: Array<{ label: string; value: string }>): string {
  return rows.map((row) => `${row.label}: ${row.value}`).join('\n');
}

function buildRowsHtml(rows: Array<{ label: string; value: string }>): string {
  const rowHtml = rows.map((row) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #ece7db;width:220px;color:#6B6158;font-size:12px;vertical-align:top;font-weight:700;letter-spacing:.03em;text-transform:uppercase;">${escapeHtml(row.label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #ece7db;font-size:14px;color:#2A241F;line-height:1.5;word-break:break-word;">${escapeHtml(row.value)}</td>
    </tr>`).join('');

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#ffffff;border:1px solid #E6E1D8;border-radius:12px;overflow:hidden;">
      ${rowHtml}
    </table>
  `;
}

function buildAdminActionText(actionType: MemberAction, rows: Array<{ label: string; value: string }>): string {
  return [
    `${ACTION_LABELS[actionType]} inkommet`,
    '',
    `Åtgärd: ${ACTION_LABELS[actionType]}`,
    '',
    buildRowsText(rows),
  ].join('\n');
}

function buildAdminActionHtml(actionType: MemberAction, rows: Array<{ label: string; value: string }>): string {
  return buildBaseEmailLayout({
    title: `${ACTION_LABELS[actionType]} inkommet`,
    subtitle: 'Ny medlemskapsbegäran registrerad i medlemssystemet.',
    preheader: `${ACTION_LABELS[actionType]} inkommet`,
    badge: 'PTO Medlemskap',
    introHtml: '<strong>Inskickade uppgifter</strong>',
    bodyHtml: buildRowsHtml(rows),
    ctaLabel: 'Öppna intranätet',
    ctaHref: `${getAppBaseUrl()}/intranet`,
    footerNote: 'Detta mejl skickades automatiskt från medlemskapsflödet.',
  });
}

function getCustomerContent(actionType: MemberAction): CustomerContent | null {
  const appBaseUrl = getAppBaseUrl();
  if (actionType === 'pause_membership') {
    return {
      subject: 'Vi har mottagit din pausbegäran',
      title: 'Din pausbegäran är mottagen',
      subtitle: 'Tack för att du uppdaterade oss.',
      introText: 'Vi har mottagit din begäran om att pausa medlemskapet.',
      detailText: 'Vårt team registrerar pausen och återkommer om något behöver kompletteras.',
      outroText: 'När du vill starta igen hjälper vi dig gärna direkt.',
      ctaLabel: 'Öppna Mina sidor',
      ctaHref: `${appBaseUrl}/profile`,
    };
  }
  if (actionType === 'reactivate_membership') {
    return {
      subject: 'Vi har mottagit din återaktivering',
      title: 'Din återaktivering är mottagen',
      subtitle: 'Vad roligt att du är igång igen.',
      introText: 'Vi har mottagit din begäran om att återaktivera medlemskapet.',
      detailText: 'Vi hanterar aktiveringen och hör av oss direkt om vi behöver något mer från dig.',
      outroText: 'Tack för förtroendet, vi ser fram emot att fortsätta resan tillsammans.',
      ctaLabel: 'Öppna Mina sidor',
      ctaHref: `${appBaseUrl}/profile`,
    };
  }
  return null;
}

function buildCustomerConfirmationText(content: CustomerContent, fullName: string): string {
  const greeting = fullName ? `Hej ${fullName},` : 'Hej,';
  return [
    greeting,
    '',
    content.introText,
    content.detailText,
    '',
    content.outroText,
    '',
    'Med vänliga hälsningar,',
    'Private Training Online',
  ].join('\n');
}

function buildCustomerConfirmationHtml(content: CustomerContent, fullName: string): string {
  const safeName = escapeHtml(fullName);
  const greeting = safeName ? `Hej ${safeName},` : 'Hej,';
  return buildBaseEmailLayout({
    title: content.title,
    subtitle: content.subtitle,
    preheader: content.subject,
    badge: 'PTO Bekräftelse',
    introHtml: `<p style="margin:0 0 10px;"><strong>${greeting}</strong></p>`,
    bodyHtml: `
      <p style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#3D3D3D;">${escapeHtml(content.introText)}</p>
      <p style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#3D3D3D;">${escapeHtml(content.detailText)}</p>
      <p style="margin:0;font-size:14px;line-height:1.65;color:#3D3D3D;">${escapeHtml(content.outroText)}</p>
    `,
    ctaLabel: content.ctaLabel,
    ctaHref: content.ctaHref,
    footerNote: 'Med vänliga hälsningar, Private Training Online',
  });
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
  const allowed = (process.env.ACTION_ALLOWED_ORIGINS || process.env.CHAT_ALLOWED_ORIGINS || '')
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

function ensureRequestId(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toFormBody(payload: Record<string, unknown>): string {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.append(key, String(value));
  });
  return params.toString();
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setCors(res, origin);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = await readBody(req);
  const actionType = body.action_type;
  const actionWebhooks = getActionWebhooks();

  if (typeof actionType !== 'string') {
    setCors(res, origin);
    res.status(400).json({ error: 'Missing action_type' });
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(actionWebhooks, actionType)) {
    setCors(res, origin);
    res.status(400).json({ error: 'Unsupported action_type' });
    return;
  }

  const typedAction = actionType as MemberAction;
  const webhookUrl = actionWebhooks[typedAction];
  if (!webhookUrl) {
    setCors(res, origin);
    res.status(501).json({ error: 'Action not enabled yet', action_type: actionType });
    return;
  }

  const payload: Record<string, unknown> = {
    ...body,
    action_type: actionType,
    request_id: ensureRequestId(body.request_id),
    requested_at: body.requested_at || new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: toFormBody(payload),
    });

    if (!response.ok) {
      setCors(res, origin);
      res.status(502).json({ error: 'Webhook failed', status: response.status });
      return;
    }

    let emailStatus: 'not_applicable' | 'skipped' | 'sent' | 'failed' = 'not_applicable';
    let emailId: string | null = null;
    let confirmationId: string | null = null;

    if (
      typedAction === 'pause_membership' ||
      typedAction === 'reactivate_membership' ||
      typedAction === 'deactivate_membership'
    ) {
      const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
      if (!resendApiKey) {
        emailStatus = 'skipped';
      } else {
        const from = (process.env.RESEND_FORM_FROM || DEFAULT_FROM).trim() || DEFAULT_FROM;
        const memberEmail = typeof payload.email === 'string' ? payload.email.trim() : '';
        const fullName = typeof payload.name === 'string' ? payload.name.trim() : '';
        const rows = buildActionRows(payload);

        try {
          const adminData = await sendResendEmail(resendApiKey, {
            from,
            to: getActionRecipients(),
            subject: `${ACTION_LABELS[typedAction]}: ${fullName || memberEmail || String(payload.request_id)}`,
            text: buildAdminActionText(typedAction, rows),
            html: buildAdminActionHtml(typedAction, rows),
            reply_to: memberEmail || undefined,
          });
          emailId = adminData?.id || null;

          const customerContent = getCustomerContent(typedAction);
          if (memberEmail && customerContent) {
            const confirmationData = await sendResendEmail(resendApiKey, {
              from,
              to: [memberEmail],
              subject: customerContent.subject,
              text: buildCustomerConfirmationText(customerContent, fullName),
              html: buildCustomerConfirmationHtml(customerContent, fullName),
              reply_to: DEFAULT_TO,
            });
            confirmationId = confirmationData?.id || null;
          }

          emailStatus = 'sent';
        } catch (emailError) {
          emailStatus = 'failed';
          console.error('Member action email error', emailError);
        }
      }
    }

    setCors(res, origin);
    res.status(200).json({
      ok: true,
      action_type: actionType,
      request_id: payload.request_id,
      email_status: emailStatus,
      email_id: emailId,
      confirmation_id: confirmationId,
    });
  } catch (error: any) {
    console.error('Member action webhook error', error);
    setCors(res, origin);
    res.status(502).json({ error: 'Webhook failed' });
  }
}
