import env from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

// Load env from monorepo root (single source of truth)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../..");
const isDev = process.env.NODE_ENV !== "production";
env.loadEnvConfig(monorepoRoot, isDev);

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://rateanything:rateanything@localhost:5433/rateanything",
  },
  verbose: true,
  strict: true,
});
