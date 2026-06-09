# med-attest-portal

Touchless self-serve signup for the [med-attest](https://github.com/DisruptionEngineer/med-attest) consent broker.

A partner (AI tool builder) signs up via Clerk → completes Stripe checkout → the portal mints them a managed `did:jwk` and registers it with the broker's admin allowlist → emails them a link to download their private key once.  Zero human in the loop.

## What this is, briefly

| | |
|---|---|
| **Stack** | Next.js 16 (App Router) · Clerk · Supabase · Stripe · Resend · Tailwind |
| **Host** | Vercel |
| **Hostname** | `portal.hotmessexpress.xyz` (pilot) |
| **DB** | Supabase — separate project from the broker's |
| **Talks to** | `broker.hotmessexpress.xyz` via `X-Admin-Auth` |

## The flow

```
landing (/)
  ↓ click "Get a DID"
sign-up (Clerk)
  ↓
/dashboard
  ↓ "no partner row" → register form (POST /api/partners/register)
  ↓ "pending_checkout" → POST /api/stripe/create-checkout → Stripe-hosted page
  ↓                                                            ↓
  ↓                                          checkout.session.completed
  ↓                                                            ↓
  ↓                                          POST /api/stripe/webhook
  ↓                                            ├ generate did:jwk
  ↓                                            ├ POST broker /admin/v1/allowed-dids
  ↓                                            ├ AES-GCM wrap private key
  ↓                                            ├ partners.status = 'active'
  ↓                                            └ Resend welcome email
  ↓                                                            ↓
/dashboard?activated=true
  ↓ "active" → DID display + "Reveal private key once" button
              (POST /api/partners/reveal-key)
```

## Layout

```
src/
├── app/
│   ├── (auth)/               # Clerk sign-in / sign-up pages
│   ├── (dashboard)/
│   │   ├── layout.tsx        # Sidebar + auth gate
│   │   └── dashboard/page.tsx
│   ├── api/
│   │   ├── partners/
│   │   │   ├── register/route.ts    # POST — create partner row
│   │   │   ├── me/route.ts          # GET — read own row
│   │   │   └── reveal-key/route.ts  # POST — one-time private key download
│   │   └── stripe/
│   │       ├── create-checkout/route.ts
│   │       └── webhook/route.ts     # ← broker integration lives here
│   ├── layout.tsx
│   └── page.tsx              # landing
├── components/
│   └── dashboard/sidebar.tsx
├── lib/
│   ├── broker.ts             # broker admin client (X-Admin-Auth)
│   ├── did-jwk.ts            # generate + encrypt Ed25519 keys
│   ├── resend.ts             # transactional email
│   ├── stripe.ts
│   ├── supabase.ts
│   └── utils.ts
├── middleware.ts             # Clerk
└── types/index.ts            # Partner + Subscription
```

## Local development

```sh
cp .env.example .env.local
# Fill every value; see DEPLOY.md for provenance of each.

npm install
npm run dev
# → http://localhost:3000
```

For Stripe webhook testing locally:

```sh
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Use the printed `whsec_...` as STRIPE_WEBHOOK_SECRET in .env.local.
```

## Schema

See [`supabase-schema.sql`](./supabase-schema.sql).  Two tables:

- **`partners`** — one row per Clerk user.  Lifecycle: `pending_checkout` → `active` → `revoked`.  Holds the DID + AES-GCM-wrapped private key (only set for managed flow).
- **`subscriptions`** — mirrors Stripe state; separate row so a future "pause subscription without revoking DID" flow doesn't have to mutate partners.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md).

## Why a separate repo?

The med-attest repo holds the broker, wallet, and protocol specs.  The portal is a customer-facing SaaS — different release cadence, different infra (Vercel vs Fly), and we want the broker repo to stay buildable without dragging Next.js + Clerk + Stripe into its CI.  Cross-references between the two are by URL + shared secret, never by code import.

## Relationship to subterra

This repo started as a fork of [`subterra`](https://github.com/DisruptionEngineer/subterra) — the same stack (Clerk + Supabase + Stripe + Resend + Next.js) but a completely different product domain.  Pipeline / webhook / report code was stripped on day one; what remains is the auth + billing + email skeleton.
