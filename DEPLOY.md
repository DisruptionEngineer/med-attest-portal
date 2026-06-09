# DEPLOY.md — med-attest-portal

Vercel deploy targeting `portal.hotmessexpress.xyz`.  Prerequisites: med-attest broker is already running (see `med-attest/docs/runbooks/deploy.md`); you have a `BROKER_ADMIN_URL` + `BROKER_ADMIN_SECRET` ready.

## Step 1 — Create the GitHub repo

```sh
cd ~/Code/med-attest-portal
gh repo create med-attest-portal --public --source=. --push
```

## Step 2 — Provision the portal Supabase project

The portal needs its OWN Supabase project (NOT the broker's — partners + subscriptions stay separate from the broker's `med_attest.*` schema).

1. https://supabase.com/dashboard → New project
   - Name: `med-attest-portal`
   - Region: pick one (US East matches the broker on Fly `iad`)
   - DB password: save it
2. Project Settings → API
   - Copy `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy `service_role` (under "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`
3. SQL Editor → paste `supabase-schema.sql` → Run

## Step 3 — Set up the service accounts

| Provider | What | Time |
|---|---|---|
| Clerk | https://clerk.com → New application "med-attest-portal" → enable Email + Password | 10 min |
| Stripe | https://stripe.com → Test mode → Products → New product "Partner Pilot" recurring $0/mo → save the price id as `STRIPE_PRICE_PILOT` | 15 min |
| Resend | https://resend.com → Domains → add `hotmessexpress.xyz` → publish DNS records → API Keys → create one | 15 min (DNS) |

## Step 4 — Generate `PORTAL_KEY_KEK`

```sh
openssl rand -base64 32
# → save as PORTAL_KEY_KEK in your password manager.  LOSS = every existing
# partner private key becomes unrecoverable.
```

## Step 5 — Vercel project + env

```sh
vercel link                  # walks through project creation
```

Set every env var listed in `.env.example`:

```sh
# Public keys are also set this way; Vercel treats `NEXT_PUBLIC_*` correctly.
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production
# ... etc for each line in .env.example
```

Or via the Vercel dashboard (Settings → Environment Variables).

## Step 6 — Deploy

```sh
vercel --prod
# → prints the deployed URL.  Note it for the next step.
```

## Step 7 — Custom domain

In the Vercel dashboard → Project → Settings → Domains → add `portal.hotmessexpress.xyz` → follow the DNS instructions (Vercel issues the cert automatically after the CNAME resolves).

## Step 8 — Wire the Stripe webhook

Now that the portal is reachable:

1. Stripe dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://portal.hotmessexpress.xyz/api/stripe/webhook`
   - Events to send:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
2. Copy the signing secret (starts with `whsec_…`) → `STRIPE_WEBHOOK_SECRET` in Vercel
3. Redeploy so the new env var takes effect: `vercel --prod`

## Step 9 — Wire the broker admin secret

The portal calls the broker's admin plane.  The shared secret was set when you deployed the broker:

```sh
# In the broker's .env / fly secrets:
ADMIN_AUTH_SECRET=<that-value>
```

Use the SAME value in the portal:

```sh
vercel env add BROKER_ADMIN_SECRET production
# → paste the broker's ADMIN_AUTH_SECRET
vercel env add BROKER_ADMIN_URL production
# → https://broker.hotmessexpress.xyz
```

Redeploy.

## Step 10 — Smoke test

1. Open `https://portal.hotmessexpress.xyz/` → landing page renders
2. Sign up with a fresh email
3. Land on `/dashboard` → fill the partner registration form
4. Click "Continue to checkout" → Stripe-hosted page → use test card `4242 4242 4242 4242`
5. Land back at `/dashboard?activated=true` → DID is shown
6. Click "Reveal private key once" → JWK printed in the dashboard
7. Confirm the broker side:
   ```sh
   curl -H "X-Admin-Auth: $ADMIN_AUTH_SECRET" \
     https://broker.hotmessexpress.xyz/admin/v1/allowed-dids?kind=requester
   # → should list the new partner's DID
   ```

## Rollback

```sh
vercel rollback   # → picks the previous successful deploy
```

For data rollback (Stripe / Supabase), follow each provider's runbook.  The portal itself has no state to lose on a rollback.
