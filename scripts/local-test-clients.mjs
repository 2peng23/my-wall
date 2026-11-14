import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

export function localTestClients() {
  const status = JSON.parse(
    execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (configuredUrl && configuredUrl !== status.API_URL)
    throw new Error(
      "Integration fixtures are restricted to this project's local Supabase URL.",
    );
  const parsedUrl = new URL(status.API_URL);
  if (!["127.0.0.1", "localhost"].includes(parsedUrl.hostname))
    throw new Error("Integration fixtures require a loopback database.");
  const options = {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, parameters) =>
        fetch(input, {
          ...parameters,
          signal: parameters?.signal ?? AbortSignal.timeout(15_000),
        }),
    },
  };
  return {
    visitor: createClient(
      status.API_URL,
      status.PUBLISHABLE_KEY || status.ANON_KEY,
      options,
    ),
    administrator: createClient(
      status.API_URL,
      status.SECRET_KEY || status.SERVICE_ROLE_KEY,
      options,
    ),
  };
}
