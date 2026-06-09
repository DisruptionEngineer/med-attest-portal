-- ============================================
-- med-attest-portal — Database Schema
-- Run this in Supabase SQL Editor for the
-- portal's Supabase project (NOT the broker's).
-- ============================================

-- ── Partners ────────────────────────────────────────────────────────────
-- One per Clerk user.  Created at sign-up, activated once their Stripe
-- checkout completes and the broker has allowlisted their DID.

CREATE TABLE partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,           -- Clerk user id
  display_name TEXT NOT NULL,             -- "Acme AI Scribe"
  contact_email TEXT NOT NULL,

  -- DID for this partner.  Two flavours:
  --   'jwk_managed' : portal generated the keypair, wraps the private key
  --                   under PORTAL_KEY_KEK and stores it below.
  --   'web_byo'     : partner supplied a did:web:... they host themselves.
  --                   private_key_encrypted stays NULL.
  did TEXT UNIQUE NOT NULL,
  did_kind TEXT NOT NULL CHECK (did_kind IN ('jwk_managed', 'web_byo')),

  -- AES-256-GCM ciphertext of the JWK private key, under PORTAL_KEY_KEK.
  -- Format: {"iv":"<b64url>","tag":"<b64url>","ct":"<b64url>"}
  -- Only set for did_kind='jwk_managed'.
  private_key_encrypted JSONB,

  -- Set once the user has clicked "Reveal once" in the dashboard.  After
  -- that the dashboard refuses a second reveal (rotation is the path).
  private_key_revealed_at TIMESTAMPTZ,

  status TEXT NOT NULL CHECK (
    status IN ('pending_checkout', 'active', 'revoked')
  ) DEFAULT 'pending_checkout',

  -- The id the broker returned from POST /admin/v1/allowed-dids.  Used
  -- for revocation (DELETE /admin/v1/allowed-dids/:id).
  broker_allowlist_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partners_user_id ON partners(user_id);
CREATE INDEX idx_partners_did ON partners(did);
CREATE INDEX idx_partners_status ON partners(status);

-- ── Subscriptions ───────────────────────────────────────────────────────
-- Mirrors Stripe's subscription state.  Kept on a separate row from
-- `partners` so a future "pause subscription without revoking DID"
-- flow doesn't have to mutate the partner record.

CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pilot', 'pro')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- ── updated_at trigger ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER partners_set_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
