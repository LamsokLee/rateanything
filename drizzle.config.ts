import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load env from monorepo root (single source of truth)
// This file lives at the monorepo root, so use process.cwd()
const monorepoRoot = process.cwd();
const isDev = process.env.NODE_ENV !== "production";
loadEnvConfig(monorepoRoot, isDev);

export default defineConfig({
  schema: "./packages/db/src/schema/index.ts",
  out: "./packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Falls back to hardcoded local dev URL if DATABASE_URL is not set
    url: process.env.DATABASE_URL || "postgresql://rateanything:rateanything@localhost:5433/rateanything",
  },
  verbose: true,
  strict: true,
});
