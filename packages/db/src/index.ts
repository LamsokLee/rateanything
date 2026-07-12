/**
 * Database client export — creates a drizzle instance with postgres.js driver.
 * Import this in your application to interact with the database.
 */
import env from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

// Load env from monorepo root (single source of truth)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");
const isDev = process.env.NODE_ENV !== "production";
env?.loadEnvConfig?.(monorepoRoot, isDev);

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

/**
 * Use a global singleton so Next.js dev hot reloads don't spawn a new
 * postgres.js pool on every module evaluation. Without this, each reload
 * leaks 10 connections and eventually exhausts Postgres.
 */
const globalForDb = globalThis as unknown as {
  __rateanythingDbClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__rateanythingDbClient ??
  postgres(connectionString, {
    // Small pool in dev (default 10 is overkill and exhausts connections
    // quickly when modules reload). In production, slightly larger.
    max: process.env.NODE_ENV === "production" ? 10 : 3,
    // Close idle connections faster in dev so the pool doesn't hold slots.
    idle_timeout: process.env.NODE_ENV === "production" ? 30 : 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__rateanythingDbClient = client;
}

/** Drizzle ORM instance with full schema for relational queries */
export const db = drizzle(client, { schema });

/** Re-export schema for convenience */
export * from "./schema/index.js";
export { schema };

/** Re-export commonly used drizzle-orm utilities */
export {
  eq, ne, gt, gte, lt, lte, and, or, not, sql,
  avg, count, sum,
  desc, asc, ilike, inArray,
} from "drizzle-orm";
