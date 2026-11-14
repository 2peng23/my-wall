import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!projectUrl || !publicKey || publicKey === "replace-with-your-public-key")
    return null;

  try {
    const parsedUrl = new URL(projectUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) return null;
    if (publicKey.startsWith("sb_secret_")) return null;
    // Legacy JWTs are supported, but a service-role key must never become a browser client.
    if (publicKey.startsWith("eyJ")) {
      const payload = JSON.parse(
        atob(publicKey.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon") return null;
    }
    browserClient = createClient(projectUrl, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, options) =>
          fetch(input, {
            ...options,
            signal: options?.signal ?? AbortSignal.timeout(20_000),
          }),
      },
    });
    return browserClient;
  } catch {
    return null;
  }
}
