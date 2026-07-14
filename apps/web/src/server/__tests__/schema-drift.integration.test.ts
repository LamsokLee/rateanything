/**
 * Schema Drift Detection Test
 *
 * This test compares expected schema definitions against the actual database
 * and FAILS if they don't match (missing columns, missing indexes, wrong types).
 *
 * PURPOSE: Catches prod-DB-drift bugs before deploy. If someone adds a Drizzle
 * column but forgets the corresponding DB migration, this test fails with a clear
 * message like "Table 'options' missing column 'rating_sum' (expected bigint)".
 *
 * This test would have caught prod 500s from:
 * - Missing rating_sum column on options
 * - Missing is_deleted column on comments
 * - Missing unique indexes for ON CONFLICT clauses
 *
 * NOTE: This test is READ-ONLY — it only queries information_schema and pg_indexes.
 * No resetDb() or data mutation needed.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { db, sql } from "@rateanything/db";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExpectedColumn {
  name: string;
  type: string;
  nullable: boolean;
}

interface ExpectedIndex {
  name: string;
  tableName: string;
  /** Substring that must appear in the index definition (column list) */
  definition: string;
}

// ─── Expected Schema Definitions ──────────────────────────────────────────────
//
// These expectations are derived from the actual database schema.
// Type mapping from Drizzle → PostgreSQL information_schema.columns.data_type:
//   uuid         → uuid
//   varchar      → character varying
//   integer      → integer
//   serial       → integer (serial is auto-incrementing integer)
//   boolean      → boolean
//   bigint       → bigint
//   real         → real | double precision (depends on migration)
//   text         → text
//   timestamp(tz)→ timestamp with time zone
//   smallint     → smallint
//   jsonb        → jsonb
//   text[]/array → ARRAY
//   inet         → inet
//   pgEnum       → USER-DEFINED | character varying (depends on migration)

const expectedColumns: Record<string, ExpectedColumn[]> = {
  users: [
    { name: "id", type: "uuid", nullable: false },
    { name: "clerk_id", type: "character varying", nullable: false },
    { name: "username", type: "character varying", nullable: false },
    { name: "email", type: "character varying", nullable: true },
    { name: "avatar_url", type: "text", nullable: true },
    { name: "bio", type: "character varying", nullable: true },
    { name: "location", type: "character varying", nullable: true },
    { name: "is_verified", type: "boolean", nullable: true },
    { name: "is_admin", type: "boolean", nullable: true },
    { name: "reputation", type: "integer", nullable: true },
    { name: "rating_count", type: "integer", nullable: true },
    { name: "follower_count", type: "integer", nullable: true },
    { name: "following_count", type: "integer", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],

  categories: [
    { name: "id", type: "integer", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "slug", type: "character varying", nullable: false },
    { name: "parent_id", type: "integer", nullable: true },
    { name: "description", type: "text", nullable: true },
    { name: "sort_order", type: "integer", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
  ],

  guests: [
    { name: "id", type: "uuid", nullable: false },
    { name: "fingerprint_hash", type: "character varying", nullable: false },
    { name: "ip_address", type: "inet", nullable: true },
    { name: "user_agent", type: "text", nullable: true },
    { name: "rating_count", type: "integer", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "last_seen", type: "timestamp with time zone", nullable: true },
  ],

  topics: [
    { name: "id", type: "uuid", nullable: false },
    { name: "title", type: "character varying", nullable: false },
    { name: "slug", type: "character varying", nullable: false },
    { name: "description", type: "character varying", nullable: true },
    { name: "category_id", type: "integer", nullable: false },
    { name: "image_url", type: "text", nullable: true },
    { name: "source_url", type: "text", nullable: true },
    { name: "creator_id", type: "uuid", nullable: false },
    { name: "status", type: "character varying", nullable: true },
    { name: "allow_new_options", type: "boolean", nullable: true },
    { name: "total_ratings", type: "integer", nullable: true },
    { name: "trending_score", type: "double precision", nullable: true },
    { name: "is_pinned", type: "boolean", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "closed_at", type: "timestamp with time zone", nullable: true },
    { name: "last_activity", type: "timestamp with time zone", nullable: true },
  ],

  options: [
    { name: "id", type: "uuid", nullable: false },
    { name: "topic_id", type: "uuid", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "description", type: "character varying", nullable: true },
    { name: "image_url", type: "text", nullable: true },
    { name: "sort_order", type: "integer", nullable: true },
    { name: "avg_rating", type: "double precision", nullable: true },
    { name: "rating_count", type: "integer", nullable: true },
    { name: "rating_sum", type: "bigint", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
  ],

  ratings: [
    { name: "id", type: "uuid", nullable: false },
    { name: "option_id", type: "uuid", nullable: false },
    { name: "user_id", type: "uuid", nullable: true },
    { name: "guest_id", type: "uuid", nullable: true },
    { name: "score", type: "smallint", nullable: false },
    { name: "comment", type: "character varying", nullable: true },
    { name: "tags", type: "ARRAY", nullable: true },
    { name: "is_edited", type: "boolean", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
  ],

  comments: [
    { name: "id", type: "uuid", nullable: false },
    { name: "rating_id", type: "uuid", nullable: true },
    { name: "user_id", type: "uuid", nullable: true },
    { name: "parent_id", type: "uuid", nullable: true },
    { name: "content", type: "character varying", nullable: false },
    { name: "upvotes", type: "integer", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "updated_at", type: "timestamp with time zone", nullable: true },
    { name: "topic_id", type: "uuid", nullable: true },
    { name: "downvotes", type: "integer", nullable: false },
    { name: "score", type: "integer", nullable: false },
    { name: "is_deleted", type: "boolean", nullable: false },
  ],

  follows: [
    { name: "follower_id", type: "uuid", nullable: false },
    { name: "following_id", type: "uuid", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
  ],

  reports: [
    { name: "id", type: "uuid", nullable: false },
    { name: "reporter_id", type: "uuid", nullable: false },
    { name: "target_type", type: "character varying", nullable: false },
    { name: "target_id", type: "uuid", nullable: false },
    { name: "reason", type: "character varying", nullable: false },
    { name: "details", type: "character varying", nullable: true },
    { name: "status", type: "character varying", nullable: true },
    { name: "created_at", type: "timestamp with time zone", nullable: true },
    { name: "resolved_at", type: "timestamp with time zone", nullable: true },
  ],

  badges: [
    { name: "id", type: "integer", nullable: false },
    { name: "name", type: "character varying", nullable: false },
    { name: "description", type: "character varying", nullable: true },
    { name: "icon", type: "character varying", nullable: false },
    { name: "criteria", type: "jsonb", nullable: false },
  ],

  user_badges: [
    { name: "user_id", type: "uuid", nullable: false },
    { name: "badge_id", type: "integer", nullable: false },
    { name: "awarded_at", type: "timestamp with time zone", nullable: true },
  ],

  comment_votes: [
    { name: "user_id", type: "uuid", nullable: false },
    { name: "comment_id", type: "uuid", nullable: false },
    { name: "vote", type: "character varying", nullable: false },
    { name: "created_at", type: "timestamp with time zone", nullable: false },
  ],
};

/**
 * Critical indexes that the application's ON CONFLICT clauses and queries depend on.
 * If any of these are missing, upserts will fail or queries will be slow.
 */
const expectedIndexes: ExpectedIndex[] = [
  // Ratings: unique constraints for ON CONFLICT in upsert logic
  { name: "one_rating_per_user", tableName: "ratings", definition: "user_id, option_id" },
  { name: "one_rating_per_guest", tableName: "ratings", definition: "guest_id, option_id" },
  { name: "ratings_pkey", tableName: "ratings", definition: "id" },

  // Options: unique constraint for topic+name
  { name: "options_topic_id_name_key", tableName: "options", definition: "topic_id, name" },
  { name: "options_pkey", tableName: "options", definition: "id" },

  // Topics: unique slug
  { name: "topics_slug_key", tableName: "topics", definition: "slug" },
  { name: "topics_pkey", tableName: "topics", definition: "id" },

  // Users: unique constraints
  { name: "users_clerk_id_key", tableName: "users", definition: "clerk_id" },
  { name: "users_username_key", tableName: "users", definition: "username" },
  { name: "users_pkey", tableName: "users", definition: "id" },

  // Guests: unique fingerprint_hash
  { name: "guests_fingerprint_hash_key", tableName: "guests", definition: "fingerprint_hash" },

  // Categories: unique slug
  { name: "categories_slug_key", tableName: "categories", definition: "slug" },

  // Badges: unique name
  { name: "badges_name_key", tableName: "badges", definition: "name" },

  // Follows: composite primary key
  { name: "follows_pkey", tableName: "follows", definition: "follower_id, following_id" },

  // Comment votes: composite primary key
  { name: "comment_votes_pkey", tableName: "comment_votes", definition: "user_id, comment_id" },

  // User badges: composite primary key
  { name: "user_badges_pkey", tableName: "user_badges", definition: "user_id, badge_id" },
];

// ─── Test Helpers ─────────────────────────────────────────────────────────────

interface DbColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string; // "YES" or "NO"
}

interface DbIndex {
  indexname: string;
  tablename: string;
  indexdef: string;
}

let dbColumns: Map<string, DbColumn[]>;
let dbIndexes: DbIndex[];

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Fetch all columns from the public schema
  const columnsResult = await db.execute<DbColumn>(sql`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  // Group columns by table name
  dbColumns = new Map<string, DbColumn[]>();
  for (const row of columnsResult) {
    const existing = dbColumns.get(row.table_name) ?? [];
    existing.push(row);
    dbColumns.set(row.table_name, existing);
  }

  // Fetch all indexes from the public schema
  const indexesResult = await db.execute<DbIndex>(sql`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
  `);
  dbIndexes = [...indexesResult];
});

describe("Schema drift detection", () => {
  // ─── Column checks per table ────────────────────────────────────────────────

  for (const [tableName, columns] of Object.entries(expectedColumns)) {
    describe(`Table: ${tableName}`, () => {
      it("table exists in the database", () => {
        expect(
          dbColumns.has(tableName),
          `Table '${tableName}' does not exist in the database`
        ).toBe(true);
      });

      for (const expected of columns) {
        it(`has column '${expected.name}' (${expected.type}, ${expected.nullable ? "nullable" : "NOT NULL"})`, () => {
          const tableColumns = dbColumns.get(tableName);
          expect(
            tableColumns,
            `Table '${tableName}' does not exist in the database`
          ).toBeDefined();

          const actual = tableColumns!.find((c) => c.column_name === expected.name);
          expect(
            actual,
            `Table '${tableName}' missing column '${expected.name}' (expected ${expected.type})`
          ).toBeDefined();

          expect(
            actual!.data_type,
            `Table '${tableName}' column '${expected.name}' has wrong type: got '${actual!.data_type}', expected '${expected.type}'`
          ).toBe(expected.type);

          const expectedNullable = expected.nullable ? "YES" : "NO";
          expect(
            actual!.is_nullable,
            `Table '${tableName}' column '${expected.name}' has wrong nullability: got '${actual!.is_nullable}', expected '${expectedNullable}' (${expected.nullable ? "nullable" : "NOT NULL"})`
          ).toBe(expectedNullable);
        });
      }
    });
  }

  // ─── Index checks ──────────────────────────────────────────────────────────

  describe("Critical indexes", () => {
    for (const expected of expectedIndexes) {
      it(`index '${expected.name}' exists on '${expected.tableName}'`, () => {
        const actual = dbIndexes.find(
          (idx) => idx.indexname === expected.name && idx.tablename === expected.tableName
        );
        expect(
          actual,
          `Missing index '${expected.name}' on table '${expected.tableName}'. This index is required for ON CONFLICT or query performance.`
        ).toBeDefined();

        // Verify the index covers the expected columns
        expect(
          actual!.indexdef,
          `Index '${expected.name}' on '${expected.tableName}' does not include expected columns (${expected.definition}). Actual definition: ${actual!.indexdef}`
        ).toContain(expected.definition);
      });
    }
  });

  // ─── Critical columns that caused prod failures ─────────────────────────────

  describe("Prod-failure-critical columns", () => {
    it("options.rating_sum exists and is bigint", () => {
      const tableColumns = dbColumns.get("options");
      expect(tableColumns, "Table 'options' does not exist").toBeDefined();

      const col = tableColumns!.find((c) => c.column_name === "rating_sum");
      expect(
        col,
        "CRITICAL: Table 'options' missing column 'rating_sum' — this caused prod 500s when computing average ratings"
      ).toBeDefined();
      expect(
        col!.data_type,
        `CRITICAL: options.rating_sum must be 'bigint' to avoid overflow, got '${col!.data_type}'`
      ).toBe("bigint");
    });

    it("comments.is_deleted exists and is boolean", () => {
      const tableColumns = dbColumns.get("comments");
      expect(tableColumns, "Table 'comments' does not exist").toBeDefined();

      const col = tableColumns!.find((c) => c.column_name === "is_deleted");
      expect(
        col,
        "CRITICAL: Table 'comments' missing column 'is_deleted' — this caused prod 500s for soft-delete filtering"
      ).toBeDefined();
      expect(
        col!.data_type,
        `CRITICAL: comments.is_deleted must be 'boolean', got '${col!.data_type}'`
      ).toBe("boolean");
    });
  });
});
