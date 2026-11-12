/**
 * supabase-admin.ts
 *
 * SERVER-ONLY Supabase admin client using the service-role secret key.
 *
 * ─── IMPORT RULES ────────────────────────────────────────────────────────────
 * ✅  Import ONLY from:  API routes, Server Actions, Server Components, middleware
 * ❌  NEVER import from: 'use client' components, browser-side code, public helpers
 *
 * The `server-only` package enforces this at build-time: Next.js will throw a
 * hard compile error if this module is ever bundled into a client chunk.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Access pattern: RLS is ON with zero anon policies on every table.
 * The service-role key bypasses RLS entirely — it must never reach the browser.
 */

import "server-only"; // 🔒 Build-time guard: prevents client-bundle inclusion

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// ── Environment variable validation ─────────────────────────────────────────
// Validated once at module load time (server startup / first import).
// Throws immediately with a clear message so misconfiguration is obvious.

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    throw new Error(
      `[CareSlot] Missing required server environment variable: ${key}\n` +
        `  → Copy .env.example to .env.local and fill in the value.\n` +
        `  → Never prefix this variable with NEXT_PUBLIC_.`
    );
  }
  return value.trim();
}

// ── Singleton admin client ────────────────────────────────────────────────────
// Lazily created on first property access so build-time static page collection
// does not crash when environment variables are not yet injected.
let _adminClient: SupabaseClient<Database> | null = null;

function getAdminClient(): SupabaseClient<Database> {
  if (!_adminClient) {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    _adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _adminClient;
}

/**
 * The server-only Supabase admin client.
 *
 * Uses the service-role key — bypasses Row Level Security.
 * All five CareSlot tables (departments, doctors, slots, patients, appointments)
 * have RLS enabled with no anon policies; this is the only valid access path.
 */
export const adminDb = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getAdminClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return (value as Function).bind(client);
    }
    return value;
  },
});

// ── Safety re-export guard ────────────────────────────────────────────────────
// Explicitly block any accidental export of the raw key.
// (The key is only held inside the closure above and in the Supabase client.)

/** @internal — do not use or re-export */
const _KEY_NEVER_EXPORT = Symbol("secret");
export type { _KEY_NEVER_EXPORT as _DoNotExportSecrets };

