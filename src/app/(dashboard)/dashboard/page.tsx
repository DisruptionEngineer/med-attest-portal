'use client';

import { useEffect, useState } from 'react';
import type { Partner } from '@/types';

/**
 * Partner dashboard.
 *
 * Three states the partner can be in:
 *   - no partner row yet  → show the onboarding form
 *   - pending_checkout    → show "complete checkout" CTA → /api/stripe/create-checkout
 *   - active              → show their DID + "reveal private key once" → /api/partners/reveal-key
 *
 * Everything authenticated; the layout enforces Clerk sign-in.
 */
export default function DashboardPage() {
  const [partner, setPartner] = useState<Partner | null | undefined>(undefined);

  useEffect(() => {
    void fetch('/api/partners/me')
      .then((r) => r.json())
      .then((j) => setPartner(j.partner ?? null));
  }, []);

  if (partner === undefined) {
    return <p className="p-8 text-sm text-gray-500">Loading…</p>;
  }
  if (partner === null) return <RegisterForm onRegistered={(p) => setPartner(p)} />;
  if (partner.status === 'pending_checkout') return <PendingCheckout partner={partner} />;
  return <ActivePartner partner={partner} />;
}

// ── register ─────────────────────────────────────────────────────────────

function RegisterForm({ onRegistered }: { onRegistered: (p: Partner) => void }) {
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch('/api/partners/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName, contact_email: contactEmail }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { message?: string }).message ?? `HTTP ${res.status}`);
      setSubmitting(false);
      return;
    }
    const me = await fetch('/api/partners/me').then((r) => r.json());
    onRegistered(me.partner);
    setSubmitting(false);
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Register your AI tool</h1>
      <p className="text-sm text-gray-500 mb-6">
        We&apos;ll mint a DID for you on checkout and allowlist it on the med-attest broker. Once
        active, your tool can authenticate against the broker via DID-Auth JWTs.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Acme AI Scribe"
            required
            minLength={2}
            maxLength={80}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-500">
            Shown to patients in approval prompts and the audit log.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Contact email</span>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="ops@acme.example"
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-500">
            We send the welcome email + service notices here. Not shown to patients.
          </span>
        </label>
        {error !== null && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Registering…' : 'Continue to checkout'}
        </button>
      </form>
    </div>
  );
}

// ── pending checkout ─────────────────────────────────────────────────────

function PendingCheckout({ partner }: { partner: Partner }) {
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    const res = await fetch('/api/stripe/create-checkout', { method: 'POST' });
    const j = (await res.json()) as { url?: string; message?: string };
    if (j.url) window.location.href = j.url;
    else {
      alert(j.message ?? `Checkout failed (HTTP ${res.status})`);
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Almost ready</h1>
      <p className="text-sm text-gray-500 mb-6">
        Hi {partner.display_name}. Complete checkout to activate your DID on the med-attest
        broker.
      </p>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Opening Stripe…' : 'Complete checkout'}
      </button>
    </div>
  );
}

// ── active ───────────────────────────────────────────────────────────────

function ActivePartner({ partner }: { partner: Partner }) {
  const [revealedKey, setRevealedKey] = useState<unknown | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const alreadyRevealed = partner.private_key_revealed_at !== null;

  async function handleReveal() {
    if (!confirm('Reveal your private key? This is the only time you can download it.')) return;
    setRevealing(true);
    const res = await fetch('/api/partners/reveal-key', { method: 'POST' });
    const j = (await res.json()) as { privateKeyJwk?: unknown; message?: string };
    if (res.ok && j.privateKeyJwk) {
      setRevealedKey(j.privateKeyJwk);
    } else {
      setRevealError(j.message ?? `HTTP ${res.status}`);
    }
    setRevealing(false);
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{partner.display_name}</h1>
        <p className="text-sm text-gray-500">
          Your AI tool is allowlisted on the med-attest broker.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Your DID</h2>
        <code className="block break-all rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono">
          {partner.did}
        </code>
        <p className="mt-2 text-xs text-gray-500">
          Authenticate against the broker by signing DID-Auth JWTs with the private key for this
          DID. Use kid <code className="font-mono">{partner.did}#0</code>.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Private key</h2>
        {alreadyRevealed ? (
          <p className="text-sm text-gray-600">
            Revealed once on {new Date(partner.private_key_revealed_at!).toLocaleString()}. To
            rotate, contact ops — automated rotation lands in a follow-up.
          </p>
        ) : revealedKey === null ? (
          <>
            <p className="text-sm text-gray-600 mb-3">
              Available for one-time download. After you click Reveal, the portal will refuse a
              second download — store the key in a vault you control.
            </p>
            <button
              type="button"
              onClick={handleReveal}
              disabled={revealing}
              className="rounded border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {revealing ? 'Decrypting…' : 'Reveal private key once'}
            </button>
            {revealError !== null && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {revealError}
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-green-700 mb-2">
              Downloaded. Copy this somewhere safe — it will not be shown again.
            </p>
            <pre className="overflow-x-auto rounded border border-gray-300 bg-gray-900 p-3 text-xs text-green-300 font-mono">
              {JSON.stringify(revealedKey, null, 2)}
            </pre>
          </>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Next steps</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          <li>
            Broker URL:{' '}
            <code className="font-mono">
              {process.env.NEXT_PUBLIC_BROKER_URL ?? 'https://broker.hotmessexpress.xyz'}
            </code>
          </li>
          <li>Use DID-Auth JWT (issuer = your DID, audience = broker URL) on every request</li>
          <li>
            Submit a GrantRequest at <code className="font-mono">/v1/grants</code>, then call
            tools via <code className="font-mono">/mcp</code>
          </li>
        </ul>
      </section>
    </div>
  );
}
