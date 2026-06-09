import { Resend } from 'resend';

/**
 * Lazy-init Resend so `next build` (which evaluates module top-level on
 * page-data collection) doesn't blow up when the build env doesn't have
 * RESEND_API_KEY.  Routes that actually need email read this getter at
 * request time, when the production env IS populated.
 */
let _resend: Resend | null = null;
export function resend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  _resend = new Resend(key);
  return _resend;
}

/**
 * Welcome email fired from the Stripe webhook after a partner activates.
 * No attachments — the private key download stays gated by the portal
 * dashboard's one-time reveal endpoint so we don't accidentally email
 * it.  The link goes to the dashboard where the partner clicks Reveal.
 */
export async function sendPartnerWelcomeEmail({
  to,
  displayName,
  did,
  dashboardUrl,
}: {
  to: string;
  displayName: string;
  did: string;
  dashboardUrl: string;
}): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? 'med-attest <noreply@hotmessexpress.xyz>';
  await resend().emails.send({
    from,
    to,
    subject: 'Your med-attest broker access is ready',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #111;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">Your DID is registered</h1>
        <p style="font-size: 14px; line-height: 1.5; color: #444;">
          Welcome ${escapeHtml(displayName)} — your AI tool is now allowlisted on the med-attest
          consent broker.  You can authenticate against the broker using DID-Auth JWTs signed by
          the private key tied to your DID:
        </p>
        <pre style="font-family: ui-monospace, SF Mono, monospace; font-size: 12px; background: #f4f4f6; border: 1px solid #e6e6ea; padding: 12px; border-radius: 6px; overflow-x: auto;">${escapeHtml(did)}</pre>
        <p style="font-size: 14px; line-height: 1.5; color: #444;">
          The private key the broker expects is waiting for you in the portal.  Click below to
          download it.  <strong>You can only download it once</strong> — store it somewhere you
          control (a password manager, a hardware key, a sealed env var on your server).
        </p>
        <p style="margin: 24px 0;">
          <a href="${dashboardUrl}" style="background: #6366f1; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">
            Open dashboard → reveal key
          </a>
        </p>
        <p style="font-size: 12px; color: #888; line-height: 1.4;">
          You're on the pilot research preview.  Patients see "Not for clinical use" disclaimers
          throughout the wallet; please honour the same posture in your AI tool until pilot exits.
        </p>
      </div>
    `,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
