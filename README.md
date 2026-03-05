<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1o3G2iaqRgdtHx_iuFYKl1jw84wxfYVmz

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Resend Form Notifications

When a user submits `/start` or `/uppfoljning`, the app posts to `api/form-notifications` and sends an admin email via Resend.

Required env vars in `.env.local`:

- `RESEND_API_KEY`
- `RESEND_FORM_TO` (optional extra admin recipients for `startform`; `info@privatetrainingonline.se` is always included)
- `RESEND_FORM_FROM` (optional, defaults to `onboarding@resend.dev`)
- `RESEND_LIVE_TEST_TO` (optional, only for live test override)

### Test Commands

- Unit tests (mocked Resend request): `npm run test:unit -- tests/formNotificationsApi.test.ts`
- Live integration test (real Resend API + delivery status polling):
  `npm run test:resend:live`

If your Resend account is still in testing mode, set `RESEND_LIVE_TEST_TO` to your Resend account email before running the live test.
