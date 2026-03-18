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

type MemberAction = 'pause_membership' | 'deactivate_membership' | 'reactivate_membership';

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

function getActionRecipients(): string[] {
  return dedupeRecipients([DEFAULT_TO, ...parseRecipientList(process.env.RESEND_MEMBER_ACTION_TO)]);
}

function getFieldLabel(key: string): string {
  return ACTION_FIELD_LABELS[key] || key;
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

  if (!isAllowedOrigin(origin, 'ACTION_ALLOWED_ORIGINS')) {
    setCors(res, origin);
    res.status(403).json({ error: 'Forbidden origin' });
    return;
  }

  if (req.method === 'OPTIONS') {
    setCors(res, origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-secret');
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
