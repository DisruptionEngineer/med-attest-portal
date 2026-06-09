import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptPrivateKey } from '@/lib/did-jwk';
import type { Partner } from '@/types';

/**
 * POST /api/partners/reveal-key
 *
 * One-time download of the partner's private JWK.  After the first
 * successful call, `private_key_revealed_at` is set and any subsequent
 * call returns 410 Gone.  Rotation is the path back — out of scope for
 * v1 portal (future endpoint POST /api/partners/rotate-key).
 *
 * This is the only way the plaintext private key ever leaves the
 * portal.  The Stripe webhook stores ciphertext; the dashboard reads
 * it back through this gate.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: partner, error } = await supabaseAdmin
    .from('partners')
    .select('id, status, private_key_encrypted, private_key_revealed_at, did')
    .eq('user_id', userId)
    .single<Pick<Partner, 'id' | 'status' | 'private_key_encrypted' | 'private_key_revealed_at' | 'did'>>();
  if (error || !partner) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (partner.status !== 'active') {
    return NextResponse.json({ error: 'not_active', status: partner.status }, { status: 409 });
  }
  if (partner.private_key_revealed_at !== null) {
    return NextResponse.json(
      {
        error: 'already_revealed',
        revealed_at: partner.private_key_revealed_at,
        message:
          'Private key was already revealed once.  Rotate the key to get a new one (POST /api/partners/rotate-key — not yet implemented).',
      },
      { status: 410 },
    );
  }
  if (!partner.private_key_encrypted) {
    return NextResponse.json(
      { error: 'no_key', message: 'No managed key on file (BYO did:web partner?)' },
      { status: 409 },
    );
  }

  let plain;
  try {
    plain = decryptPrivateKey(partner.private_key_encrypted);
  } catch (err) {
    return NextResponse.json(
      { error: 'decrypt_failed', message: (err as Error).message },
      { status: 500 },
    );
  }

  // Mark revealed BEFORE returning the response — if the persist fails
  // we'd rather refuse-on-retry than hand out the key twice.
  const { error: updateErr } = await supabaseAdmin
    .from('partners')
    .update({ private_key_revealed_at: new Date().toISOString() })
    .eq('id', partner.id);
  if (updateErr) {
    return NextResponse.json(
      { error: 'persist_failed', message: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    did: partner.did,
    privateKeyJwk: plain,
    publicKeyJwkInDid: partner.did.slice('did:jwk:'.length),
  });
}
