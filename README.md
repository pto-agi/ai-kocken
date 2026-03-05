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

## Resend Notifications (All Core Flows)

The app now sends Resend emails for all requested client workflows:

- `startform` (`/start`) via `api/form-notifications`
- `uppfoljning` (`/uppfoljning`) via `api/form-notifications`
- `forlangning` (`/forlangning`) via `api/form-notifications`
- `pause_membership` (`/profile`) via `api/member-actions`
- `reactivate_membership` (`/profile`) via `api/member-actions`

For each flow:

- admin gets a notification to `info@privatetrainingonline.se` (plus optional extra recipients)
- customer gets a confirmation email with `reply_to: info@privatetrainingonline.se`
- emails use the PTO base HTML layout

Required env vars for local and Render:

- `RESEND_API_KEY`
- `RESEND_FORM_FROM` (optional, defaults to `onboarding@resend.dev`)
- `RESEND_FORM_TO` (optional extra admin recipients for startform notifications)
- `RESEND_MEMBER_ACTION_TO` (optional extra admin recipients for pause/reactivate notifications)
- `ZAPIER_PAUSE_WEBHOOK_URL` (required for pause workflow)
- `ZAPIER_REACTIVATE_WEBHOOK_URL` (required for reactivate workflow)
- `ZAPIER_DEACTIVATE_WEBHOOK_URL` (optional, only if deactivate workflow is enabled)
- `MAIL_APP_BASE_URL` (optional, used in email CTA links; defaults to `https://my.privatetrainingonline.se`)
- `MAIL_LOGO_URL` (optional, custom public logo URL for emails)
- `RESEND_LIVE_TEST_TO` (optional, only for live test override)

### Test Commands

- Unit tests (mocked Resend requests):
  `npm run test:unit -- tests/formNotificationsApi.test.ts tests/memberActionsApi.test.ts`
- Live integration test (real Resend API + delivery status polling):
  `npm run test:resend:live`

If your Resend account is still in testing mode, set `RESEND_LIVE_TEST_TO` to your Resend account email before running the live test.
