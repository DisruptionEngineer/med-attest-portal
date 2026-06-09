import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/partners/register
 *
 * Creates the partner row in `pending_checkout` state.  The actual DID
 * + broker allowlist add happens later in the Stripe webhook handler
 * (so unpaid signups don't take up DID space).
 *
 * Idempotent on (user_id, status='pending_checkout') — re-registering
 * with the same display name + email is a no-op; changing them
 * updates the row.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { display_name?: string; contact_email?: string }
    | null;
  if (!body || !body.display_name || !body.contact_email) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'display_name + contact_email required' },
      { status: 400 },
    );
  }
  if (body.display_name.length < 2 || body.display_name.length > 80) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'display_name must be 2-80 chars' },
      { status: 400 },
    );
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.contact_email)) {
    return NextResponse.json(
      { error: 'invalid_request', message: 'contact_email must be a valid address' },
      { status: 400 },
    );
  }

  // Use the user_id as the DID placeholder until checkout.  The schema
  // requires `did` UNIQUE NOT NULL, so we seed it with a sentinel that
  // gets replaced by the real did:jwk on checkout.session.completed.
  const placeholderDid = `urn:portal:pending:${userId}`;

  const { error } = await supabaseAdmin.from('partners').upsert(
    {
      user_id: userId,
      display_name: body.display_name,
      contact_email: body.contact_email,
      did: placeholderDid,
      did_kind: 'jwk_managed',
      status: 'pending_checkout',
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    return NextResponse.json(
      { error: 'persist_failed', message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
