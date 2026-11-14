import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const cli = resolve("node_modules/.bin/supabase");
const excluded =
  "studio,mailpit,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta";
const environmentPath = resolve(".env.local");
const networkName = "mywall-local";
const managedHeader = "# Managed local My Wall connection.";

try {
  console.log("Starting this project's local Supabase services…");
  let network;
  try {
    network = JSON.parse(
      execFileSync("docker", ["network", "inspect", networkName], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    )[0];
  } catch {
    execFileSync(
      "docker",
      [
        "network",
        "create",
        "--label",
        "com.mywall.project=mywall",
        "-o",
        "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
        networkName,
      ],
      { stdio: "pipe" },
    );
  }
  if (
    network &&
    network.Options?.["com.docker.network.bridge.host_binding_ipv4"] !==
      "127.0.0.1"
  )
    throw new Error(
      "The mywall-local Docker network has conflicting settings. It was not changed.",
    );
  execFileSync(cli, ["start", "--network-id", networkName, "-x", excluded], {
    stdio: "pipe",
    timeout: 600_000,
  });
  execFileSync(cli, ["migration", "up"], { stdio: "pipe", timeout: 120_000 });
  const status = JSON.parse(
    execFileSync(cli, ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  if (!status.API_URL || !publicKey)
    throw new Error(
      "Local database started, but its public connection settings were unavailable.",
    );
  const managedSettings = `${managedHeader}\nNEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publicKey}\n`;
  if (
    existsSync(environmentPath) &&
    !readFileSync(environmentPath, "utf8").startsWith(managedHeader)
  ) {
    console.log("Kept your existing .env.local. Local Supabase is ready.");
  } else {
    writeFileSync(environmentPath, managedSettings, { mode: 0o600 });
    console.log(
      "Wrote local browser-safe connection settings to .env.local. No private keys were copied.",
    );
  }
  console.log("Run npm run dev, then open http://127.0.0.1:3000.");
} catch (error) {
  // CLI output can contain credentials: never copy its raw stdout/stderr into logs.
  console.error(
    "Local setup couldn't finish. Check Docker is running and ports 54321/54322 are free. Existing project data was preserved.",
  );
  if (error instanceof Error && !("stdout" in error))
    console.error(error.message);
  process.exitCode = 1;
}
