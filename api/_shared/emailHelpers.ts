/**
 * Shared email helpers — Resend API integration and HTML email layout.
 * Used by form-notifications.ts and member-actions.ts.
 */
import { escapeHtml } from './apiHelpers.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RESEND_API_URL = 'https://api.resend.com/emails';
export const DEFAULT_FROM = 'onboarding@resend.dev';
export const DEFAULT_TO = 'info@privatetrainingonline.se';
export const DEFAULT_APP_BASE_URL = 'https://my.privatetrainingonline.se';
export const DEFAULT_LOGO_PATH = '/pto-logotyp-2026.png';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResendPayload = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
  reply_to?: string;
};

export type BaseEmailLayoutParams = {
  title: string;
  subtitle?: string;
  preheader?: string;
  badge?: string;
  introHtml?: string;
  bodyHtml?: string;
  hideHero?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  footerNote?: string;
};

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

export function getAppBaseUrl(): string {
  return (process.env.MAIL_APP_BASE_URL || process.env.PUBLIC_APP_URL || DEFAULT_APP_BASE_URL).trim().replace(/\/+$/, '');
}

export function getBrandLogoUrl(): string {
  const configured = (process.env.MAIL_LOGO_URL || '').trim();
  if (configured) return configured;
  return `${getAppBaseUrl()}${DEFAULT_LOGO_PATH}`;
}

// ---------------------------------------------------------------------------
// Recipient helpers
// ---------------------------------------------------------------------------

export function parseRecipientList(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function dedupeRecipients(recipients: string[]): string[] {
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

// ---------------------------------------------------------------------------
// Resend API
// ---------------------------------------------------------------------------

export async function sendResendEmail(apiKey: string, payload: ResendPayload): Promise<{ id?: string | null }> {
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

// ---------------------------------------------------------------------------
// Email HTML layout
// ---------------------------------------------------------------------------

export function buildBaseEmailLayout(params: BaseEmailLayoutParams): string {
  const appBaseUrl = getAppBaseUrl();
  const logoUrl = getBrandLogoUrl();
  const preheader = escapeHtml(params.preheader || params.title);
  const title = escapeHtml(params.title);
  const subtitle = params.subtitle ? escapeHtml(params.subtitle) : '';
  const badge = escapeHtml(params.badge || 'Private Training Online');
  const footerNote = escapeHtml(params.footerNote || 'Detta mejl skickades automatiskt från medlemssystemet.');
  const bodyHtml = typeof params.bodyHtml === 'string' ? params.bodyHtml.trim() : '';
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
  const bodyBlock = bodyHtml
    ? `
            <tr>
              <td style="padding:10px 24px 18px;">
                <div style="background:#F6F1E7;border:1px solid #E6E1D8;border-radius:14px;padding:16px;">
                  ${bodyHtml}
                </div>
              </td>
            </tr>`
    : '';
  const heroBlock = params.hideHero
    ? `
            <tr>
              <td style="padding:26px 24px 18px;background:#fff;">
                ${params.introHtml ? `<div style="font-size:14px;line-height:1.65;color:#3D3D3D;">${params.introHtml}</div>` : ''}
              </td>
            </tr>`
    : `
            <tr>
              <td style="padding:26px 24px 8px;background:#fff;">
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#2A241F;font-weight:900;">${title}</h1>
                ${subtitle ? `<p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#6B6158;">${subtitle}</p>` : ''}
                ${params.introHtml ? `<div style="margin:14px 0 0;font-size:14px;line-height:1.65;color:#3D3D3D;">${params.introHtml}</div>` : ''}
                ${ctaBlock}
              </td>
            </tr>`;

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
            ${heroBlock}
            ${bodyBlock}
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
