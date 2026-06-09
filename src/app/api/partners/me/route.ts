import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { Partner } from '@/types';

/**
 * GET /api/partners/me
 *
 * Returns the signed-in user's partner record (without the encrypted
 * private key — that's served only via the one-time reveal endpoint).
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('partners')
    .select(
      'id, display_name, contact_email, did, did_kind, status, broker_allowlist_id, private_key_revealed_at, created_at, updated_at',
    )
    .eq('user_id', userId)
    .single<Omit<Partner, 'private_key_encrypted' | 'user_id'>>();

  if (error || !data) {
    return NextResponse.json({ partner: null });
  }
  return NextResponse.json({ partner: data });
}
