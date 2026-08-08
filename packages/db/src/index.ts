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

/**
 * Lazy singleton pattern — don't throw at import time so builds that
 * import the package but don't actually query the DB (e.g. Vercel Preview
 * deployments without a database env) can still compile.
 *
 * The db is only created on first access. If DATABASE_URL is missing,
 * all db calls will fail at runtime with a clear error.
 */
const globalForDb = globalThis as unknown as {
  __rateanythingDbConnectionString?: string;
  __rateanythingDbClient?: ReturnType<typeof postgres>;
  __rateanythingDrizzle?: ReturnType<typeof drizzle>;
};

function getClient(): ReturnType<typeof postgres> {
  if (globalForDb.__rateanythingDbClient) return globalForDb.__rateanythingDbClient;

  const cs = connectionString ?? globalForDb.__rateanythingDbConnectionString;
  if (!cs) {
    throw new Error(
      "DATABASE_URL environment variable is required. " +
        "Set it in your environment or call initDb() before first use."
    );
  }

  const isTransactionPooler = /:6543(?:\/|$)/.test(cs);

  globalForDb.__rateanythingDbClient = postgres(cs, {
    // Serverless: keep the pool tiny. The transaction pooler handles concurrency,
    // so one connection per function instance is enough and avoids exhausting
    // the upstream pool.
    max: process.env.NODE_ENV === "production" ? 1 : 3,
    idle_timeout: process.env.NODE_ENV === "production" ? 5 : 10,
    // Supabase transaction pooler (port 6543) does not support prepared statements.
    prepare: isTransactionPooler ? false : undefined,
  });

  return globalForDb.__rateanythingDbClient;
}

function getDb(): ReturnType<typeof drizzle> {
  if (globalForDb.__rateanythingDrizzle) return globalForDb.__rateanythingDrizzle;
  globalForDb.__rateanythingDrizzle = drizzle(getClient(), { schema });
  return globalForDb.__rateanythingDrizzle;
}

/**
 * Explicitly initialize the database connection with a custom URL.
 * Useful for tests or environments where DATABASE_URL isn't in process.env.
 */
export function initDb(url: string): ReturnType<typeof drizzle> {
  globalForDb.__rateanythingDbConnectionString = url;
  // Clear cached client so next getClient() creates a fresh one
  delete globalForDb.__rateanythingDbClient;
  delete globalForDb.__rateanythingDrizzle;
  return getDb();
}

/**
 * Lazy drizzle instance — connection is established on first query,
 * not at import time.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

/** Re-export schema for convenience */
export * from "./schema/index.js";
export { schema };

/** Re-export commonly used drizzle-orm utilities */
export {
  eq, ne, gt, gte, lt, lte, and, or, not, sql,
  avg, count, sum,
  desc, asc, ilike, inArray,
} from "drizzle-orm";

/** Re-export pg-core utilities */
export { alias } from "drizzle-orm/pg-core";
