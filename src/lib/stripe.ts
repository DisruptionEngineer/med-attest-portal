import Stripe from 'stripe';

/**
 * Lazy-init Stripe so `next build` doesn't fail when STRIPE_SECRET_KEY is
 * unset in the build environment.  Route handlers reach the client
 * through the Proxy below at request time, when the production env IS
 * populated.
 */
let _stripe: Stripe | null = null;
function stripeClient(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  _stripe = new Stripe(key, {
    apiVersion: '2026-02-25.clover',
  });
  return _stripe;
}

/** Lazy proxy — every property access goes through the request-time client. */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop, recv) {
    return Reflect.get(stripeClient(), prop, recv);
  },
});
