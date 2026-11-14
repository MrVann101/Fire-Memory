import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function isMocksEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCKS === "true";
}

let cachedClient: SupabaseClient | null = null;

/**
 * Returns a server-side Supabase client.
 * Uses SUPABASE_SERVICE_ROLE_KEY when available on the server; falls back to anon key.
 * Never imports or logs secrets on the client.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  if (!url || !key) {
    throw new DatabaseProviderError(
      "Database connection is not configured on the server."
    );
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

export class DatabaseProviderError extends Error {
  public readonly statusCode = 500;
  public readonly code = "DATABASE_PROVIDER_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "DatabaseProviderError";
  }
}
