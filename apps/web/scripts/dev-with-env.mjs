/**
 * Dev script wrapper: loads env from monorepo root (single source of truth)
 * into process.env BEFORE starting next dev. This ensures Edge middleware
 * and all Next.js runtimes see the env vars natively — no symlinks needed.
 *
 * Usage: node scripts/dev-with-env.mjs [next dev args...]
 */
import env from "@next/env";
import { spawn } from "node:child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { loadEnvConfig } = env;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(__dirname, "../../..");
const isDev = true;

// Load .env, .env.development, .env.development.local from monorepo root
let combinedEnv, loadedEnvFiles;
try {
  ({ combinedEnv, loadedEnvFiles } = loadEnvConfig(monorepoRoot, isDev));
} catch (err) {
  console.error("[dev-with-env] Failed to load env config:", err.message);
  process.exit(1);
}

// Log which files were loaded (preserving existing logging convention)
console.log("[dev-with-env] Loaded env from monorepo root:");
for (const f of loadedEnvFiles) {
  if (f.contents) {
    console.log(`  ✓ ${path.relative(monorepoRoot, f.path)}`);
  }
}

// Inject loaded vars into process.env so next dev inherits them
Object.assign(process.env, combinedEnv);

// Log redacted confirmation — never print secrets
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  try {
    const u = new URL(dbUrl);
    console.log(`[dev-with-env] DATABASE_URL=***set*** (${u.hostname}:${u.port || 5432})`);
  } catch {
    console.log("[dev-with-env] DATABASE_URL=***set***");
  }
} else {
  console.log("[dev-with-env] DATABASE_URL is NOT set");
}

// Forward all remaining args (e.g., --port 3001 --hostname 0.0.0.0)
const args = ["dev", ...process.argv.slice(2)];

// Resolve next binary — check local node_modules first, then hoisted root
const localNext = path.resolve(webRoot, "node_modules/.bin/next");
const hoistedNext = path.resolve(monorepoRoot, "node_modules/.bin/next");
const nextBin = existsSync(localNext) ? localNext : hoistedNext;

console.log(`[dev-with-env] Starting: ${nextBin} ${args.join(" ")}`);

// Use async spawn with signal forwarding for proper cleanup
const child = spawn(nextBin, args, { stdio: "inherit", env: process.env, cwd: webRoot });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
