import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Lazy-init Supabase clients so `next build` doesn't crash when env vars
 * are absent.  Route handlers + server components reach the clients
 * through the Proxies below at request time.
 */
let _anon: SupabaseClient | null = null;
let _admin: SupabaseClient | null = null;

function anonClient(): SupabaseClient {
  if (_anon) return _anon;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set');
  }
  _anon = createClient(url, key);
  return _anon;
}

function adminClient(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set');
  }
  _admin = createClient(url, key);
  return _admin;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop, recv) {
    return Reflect.get(anonClient(), prop, recv);
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop, recv) {
    return Reflect.get(adminClient(), prop, recv);
  },
});
