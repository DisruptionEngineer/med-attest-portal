/**
 * Supabase row types — keep in sync with `supabase-schema.sql`.
 */

export interface Partner {
  id: string;
  user_id: string;
  display_name: string;
  contact_email: string;
  did: string;
  did_kind: 'jwk_managed' | 'web_byo';
  private_key_encrypted: EncryptedJwk | null;
  private_key_revealed_at: string | null;
  status: 'pending_checkout' | 'active' | 'revoked';
  broker_allowlist_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EncryptedJwk {
  iv: string;
  tag: string;
  ct: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: 'free' | 'pilot' | 'pro';
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}
