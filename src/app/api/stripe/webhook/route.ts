import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptPrivateKey, generateDidJwk } from '@/lib/did-jwk';
import { registerPartnerOnBroker, revokePartnerOnBroker } from '@/lib/broker';
import { sendPartnerWelcomeEmail } from '@/lib/resend';
import type { Partner } from '@/types';

/**
 * POST /api/stripe/webhook
 *
 * Stripe → portal.  Sole signal that drives the touchless allowlist flow.
 *
 * `checkout.session.completed` is the moneymaker:
 *   1. Look up the partner row (created at sign-up).
 *   2. Generate a managed did:jwk.
 *   3. Register it with the broker's allowlist via X-Admin-Auth.
 *   4. Wrap the private key under PORTAL_KEY_KEK + store the ciphertext.
 *   5. Mark the partner active; record the broker allowlist id.
 *   6. Email the partner a link to the dashboard "reveal once" page.
 *
 * Failures along the way return a 5xx so Stripe retries.  We rely on the
 * unique-DID constraint + idempotent broker allowlist add to keep retries
 * safe.
 *
 * `customer.subscription.deleted` triggers the inverse: revoke the DID on
 * the broker, flip status to 'revoked'.  Private key stays encrypted in
 * the row for audit history; future-us decides retention policy.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('webhook signature verification failed:', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (!userId) {
        console.error('checkout.session.completed without user_id metadata');
        return NextResponse.json({ error: 'missing user_id' }, { status: 200 });
      }
      try {
        await activatePartner({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
        });
      } catch (err) {
        console.error('activatePartner failed for', userId, err);
        return NextResponse.json(
          { error: 'activation_failed', message: (err as Error).message },
          { status: 500 },
        );
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const subData = sub as unknown as {
        current_period_start?: number;
        current_period_end?: number;
      };
      if (sub.status === 'active') {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            current_period_start: subData.current_period_start
              ? new Date(subData.current_period_start * 1000).toISOString()
              : null,
            current_period_end: subData.current_period_end
              ? new Date(subData.current_period_end * 1000).toISOString()
              : null,
          })
          .eq('stripe_subscription_id', sub.id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (userId) {
        try {
          await revokePartner({ userId, reason: 'stripe_subscription_deleted' });
        } catch (err) {
          console.error('revokePartner failed for', userId, err);
          // 200 anyway — we don't want Stripe to retry indefinitely on a
          // broker outage; the operator can manually re-revoke if needed.
        }
      }
      await supabaseAdmin
        .from('subscriptions')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_subscription_id', sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

// ── activate (checkout.session.completed) ────────────────────────────────

async function activatePartner(args: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}): Promise<void> {
  const { userId, stripeCustomerId, stripeSubscriptionId } = args;

  // Refuse to activate a partner that doesn't exist yet — /api/partners/register
  // is the only entry point for the row.
  const { data: existing, error: lookupErr } = await supabaseAdmin
    .from('partners')
    .select('id, display_name, contact_email, status, did')
    .eq('user_id', userId)
    .single<Pick<Partner, 'id' | 'display_name' | 'contact_email' | 'status' | 'did'>>();
  if (lookupErr) throw new Error(`partner row lookup failed: ${lookupErr.message}`);
  if (!existing) throw new Error(`no partner row for user_id=${userId}`);
  if (existing.status === 'active') return; // already activated — idempotent

  // Generate the DID + wrap the private key.
  const generated = generateDidJwk();
  const wrapped = encryptPrivateKey(generated.privateKeyJwk);

  // Call the broker first.  If it fails we don't write the DID locally,
  // so a retry produces a different DID and the broker stays consistent.
  const { allowlistId } = await registerPartnerOnBroker({
    did: generated.did,
    label: existing.display_name,
  });

  // Persist activation.
  const { error: updateErr } = await supabaseAdmin
    .from('partners')
    .update({
      did: generated.did,
      did_kind: 'jwk_managed',
      private_key_encrypted: wrapped,
      status: 'active',
      broker_allowlist_id: allowlistId,
    })
    .eq('id', existing.id);
  if (updateErr) {
    // We just registered the DID on the broker but failed to persist
    // locally.  Best-effort revoke so the broker doesn't carry an
    // orphaned entry; either way Stripe retries the webhook and we'll
    // converge.
    await revokePartnerOnBroker({ did: generated.did, reason: 'portal_persist_failed' }).catch(
      () => {},
    );
    throw new Error(`partner update failed: ${updateErr.message}`);
  }

  // Upsert the subscription row so the dashboard shows billing context.
  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      plan: 'pilot',
    },
    { onConflict: 'user_id' },
  );

  // Send the welcome email.  Failures don't block activation — the
  // partner can find the same info in the dashboard.
  await sendPartnerWelcomeEmail({
    to: existing.contact_email,
    displayName: existing.display_name,
    did: generated.did,
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  }).catch((err) => console.error('welcome email failed:', err));
}

// ── revoke (customer.subscription.deleted) ───────────────────────────────

async function revokePartner(args: { userId: string; reason: string }): Promise<void> {
  const { data: partner } = await supabaseAdmin
    .from('partners')
    .select('did, status')
    .eq('user_id', args.userId)
    .single<Pick<Partner, 'did' | 'status'>>();
  if (!partner || partner.status === 'revoked') return;
  await revokePartnerOnBroker({ did: partner.did, reason: args.reason });
  await supabaseAdmin.from('partners').update({ status: 'revoked' }).eq('user_id', args.userId);
}
