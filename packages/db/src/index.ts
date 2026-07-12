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
 * postgres.js client for query execution.
 * max: 10 keeps connection pool reasonable for development.
 */
const client = postgres(connectionString, { max: 10 });

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
