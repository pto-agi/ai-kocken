# Supabase Auth Email Templates (PTO Style)

These account emails are sent by Supabase Auth (not by `api/form-notifications.ts`), so they must be styled in the Supabase Dashboard.

## Where to paste

1. Open Supabase project dashboard.
2. Go to `Authentication` -> `Email Templates`.
3. For each template type below, paste the matching HTML.
4. Keep Supabase placeholders (`{{ ... }}`) exactly as written.

## Logo URL (recommended for Supabase preview)

Use a public Supabase Storage URL for logo assets (more reliable in Supabase template preview).

1. Create a public bucket, for example: `email-assets`
2. Upload: `pto-logotyp-2026.png`
3. Use URL format:
   `https://<project-ref>.supabase.co/storage/v1/object/public/email-assets/pto-logotyp-2026.png`

In templates below, replace `{{LOGO_URL}}` with your final public Storage URL.

---

## 1) Confirm Signup / Magic Link

```html
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bekräfta din e-post</title>
  </head>
  <body style="margin:0;padding:0;background:#F6F1E7;font-family:Arial,Helvetica,sans-serif;color:#2A241F;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 10px;background:#F6F1E7;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border:1px solid #E6E1D8;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:18px 24px;background:#3D3D3D;border-bottom:3px solid #a0c81d;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td><img src="{{LOGO_URL}}" alt="PTO" width="34" height="34" style="display:block;border:0;" /></td>
                    <td style="padding-left:10px;color:#E6E1D8;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;">Private Training Online</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px 8px;">
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#2A241F;font-weight:900;">Bekräfta din e-post</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#6B6158;">Klicka på knappen för att aktivera ditt konto.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 0;">
                  <tr>
                    <td style="border-radius:12px;background:#a0c81d;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 18px;color:#2A241F;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;">Bekräfta konto</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;background:#F4F0E6;border-top:1px solid #E6E1D8;color:#6B6158;font-size:12px;">
                Om knappen inte fungerar kan du kopiera länken: {{ .ConfirmationURL }}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2) Reset Password

```html
<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Återställ lösenord</title>
  </head>
  <body style="margin:0;padding:0;background:#F6F1E7;font-family:Arial,Helvetica,sans-serif;color:#2A241F;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 10px;background:#F6F1E7;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fff;border:1px solid #E6E1D8;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:18px 24px;background:#3D3D3D;border-bottom:3px solid #a0c81d;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td><img src="{{LOGO_URL}}" alt="PTO" width="34" height="34" style="display:block;border:0;" /></td>
                    <td style="padding-left:10px;color:#E6E1D8;font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;">Private Training Online</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 24px 8px;">
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:#2A241F;font-weight:900;">Återställ ditt lösenord</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:#6B6158;">Vi har mottagit en begäran om lösenordsåterställning.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 0;">
                  <tr>
                    <td style="border-radius:12px;background:#a0c81d;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 18px;color:#2A241F;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;">Välj nytt lösenord</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;background:#F4F0E6;border-top:1px solid #E6E1D8;color:#6B6158;font-size:12px;">
                Om du inte begärde detta kan du ignorera mejlet.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 3) Change Email

Use the same layout and button style, but with:

- Title: `Bekräfta ny e-postadress`
- CTA label: `Bekräfta e-post`
- Link: `{{ .ConfirmationURL }}`
