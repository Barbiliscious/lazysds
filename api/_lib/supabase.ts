import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client, used only for the barcode mapping table (a
 * fast local check before calling any external provider). Uses the same
 * URL + anon key as the browser client - neither is secret (RLS is what
 * limits access) - but Vite only injects VITE_-prefixed vars into the
 * client bundle, so api/ needs its own (non-VITE_) copies in env vars.
 * Falls back to the VITE_ names so a fresh checkout still works locally
 * without duplicating .env.local entries.
 */

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

export function getServerSupabaseClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Missing SUPABASE_URL / SUPABASE_ANON_KEY (or VITE_ equivalents). Add them to Vercel env vars / .env.local.",
    );
  }
  client ??= createClient(url, anonKey);
  return client;
}
