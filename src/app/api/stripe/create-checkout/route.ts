import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/stripe/create-checkout
 *
 * Starts a Stripe Checkout session for the Pilot plan.  The session's
 * `metadata.user_id` lets the webhook handler look the partner up on
 * `checkout.session.completed`.
 *
 * The user MUST have a `partners` row already (created at signup via
 * /api/partners/register).  We refuse to checkout without one — the
 * webhook handler needs that row to mint the DID and call the broker.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: partner } = await supabaseAdmin
    .from('partners')
    .select('id, status')
    .eq('user_id', userId)
    .single();

  if (!partner) {
    return NextResponse.json(
      { error: 'no_partner_row', message: 'Register first via /api/partners/register' },
      { status: 400 },
    );
  }
  if (partner.status === 'active') {
    return NextResponse.json(
      { error: 'already_active', message: 'Partner already has an active subscription' },
      { status: 400 },
    );
  }

  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single();

  let customerId = subscription?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { user_id: userId },
    });
    customerId = customer.id;
  }

  const priceId = process.env.STRIPE_PRICE_PILOT;
  if (!priceId) {
    return NextResponse.json(
      { error: 'misconfigured', message: 'STRIPE_PRICE_PILOT not set' },
      { status: 500 },
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?activated=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    metadata: { user_id: userId },
    subscription_data: { metadata: { user_id: userId } },
  });

  return NextResponse.json({ url: session.url });
}
