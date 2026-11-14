import { execFileSync } from "node:child_process";

try {
  const status = JSON.parse(
    execFileSync("./node_modules/.bin/supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  console.log(`Local Supabase: ${status.API_URL}`);
  console.log(
    "Public and private credentials are hidden. Run npm run setup:local to configure the app safely.",
  );
} catch {
  console.error(
    "This project's local Supabase is not running. Start Docker, then run npm run setup:local.",
  );
  process.exitCode = 1;
}
