/**
 * Broker admin client.
 *
 * Calls the med-attest broker's /admin/v1/* surface from the portal.
 * Authentication: shared `X-Admin-Auth` secret.  Operators MUST set
 * BROKER_ADMIN_URL + BROKER_ADMIN_SECRET in the portal's env.  In a
 * production deploy these come from Vercel project secrets, NOT from
 * `.env.local` committed anywhere.
 *
 * Errors thrown by this module carry the broker's response status +
 * body so the webhook handler can log them and return a 5xx that
 * Stripe will retry.
 */

export interface RegisterPartnerArgs {
  /** The partner's DID — did:jwk for managed flow, did:web for BYO. */
  did: string;
  /** Human label that ends up in the broker's allowlist UI. */
  label: string;
}

export interface RegisterPartnerResult {
  /** The broker's allowlist record id, used for later DELETE. */
  allowlistId: string;
}

export interface RevokePartnerArgs {
  did: string;
  reason?: string;
}

class BrokerAdminError extends Error {
  override readonly name = 'BrokerAdminError';
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function brokerConfig(): { url: string; secret: string } {
  const url = process.env.BROKER_ADMIN_URL?.replace(/\/+$/, '');
  const secret = process.env.BROKER_ADMIN_SECRET;
  if (!url) throw new Error('BROKER_ADMIN_URL is not set');
  if (!secret) throw new Error('BROKER_ADMIN_SECRET is not set');
  return { url, secret };
}

export async function registerPartnerOnBroker(
  args: RegisterPartnerArgs,
): Promise<RegisterPartnerResult> {
  const { url, secret } = brokerConfig();
  const res = await fetch(`${url}/admin/v1/allowed-dids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Auth': secret,
    },
    body: JSON.stringify({
      did: args.did,
      label: args.label,
      kind: 'requester',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '<no-body>');
    throw new BrokerAdminError(
      res.status,
      `broker /admin/v1/allowed-dids failed: ${res.status} ${body}`,
    );
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) {
    throw new BrokerAdminError(500, `broker response missing id field: ${JSON.stringify(body)}`);
  }
  return { allowlistId: body.id };
}

export async function revokePartnerOnBroker(args: RevokePartnerArgs): Promise<void> {
  const { url, secret } = brokerConfig();
  const encoded = encodeURIComponent(args.did);
  const res = await fetch(`${url}/admin/v1/allowed-dids/${encoded}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Auth': secret,
    },
    body: JSON.stringify(args.reason ? { reason: args.reason } : {}),
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '<no-body>');
    throw new BrokerAdminError(
      res.status,
      `broker DELETE /admin/v1/allowed-dids/:did failed: ${res.status} ${body}`,
    );
  }
}
