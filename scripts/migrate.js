/**
 * Idempotent production DB migration — runs in CI/CD before Vercel deploy.
 * Only adds missing columns/tables, never destructive.
 *
 * Run: DATABASE_URL=... node scripts/migrate.js
 */
import postgres from 'postgres';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(databaseUrl, {
    ssl: { rejectUnauthorized: false },
    prepare: false,
  });

  // Enable pg_trgm extension
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  console.log('✅ pg_trgm extension ready');

  // Create enum types (idempotent)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'topic_status') THEN
        CREATE TYPE topic_status AS ENUM ('draft', 'active', 'closed', 'archived');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_target_type') THEN
        CREATE TYPE report_target_type AS ENUM ('topic', 'rating', 'comment', 'user');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
      END IF;
    END $$;
  `;
  console.log('✅ Enum types ready');

  // Idempotent: add missing columns only
  const migrations = [
    // options.rating_sum (bigint, default 0)
    {
      table: 'options',
      column: 'rating_sum',
      sql: `ALTER TABLE options ADD COLUMN IF NOT EXISTS rating_sum bigint NOT NULL DEFAULT 0;`,
    },
    // comments.is_deleted (boolean, default false)
    {
      table: 'comments',
      column: 'is_deleted',
      sql: `ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;`,
    },
    // comments.rating_id (uuid, nullable) — if missing
    {
      table: 'comments',
      column: 'rating_id',
      sql: `ALTER TABLE comments ADD COLUMN IF NOT EXISTS rating_id uuid REFERENCES ratings(id) ON DELETE CASCADE;`,
    },
    // users.updated_at (timestamp) — if missing
    {
      table: 'users',
      column: 'updated_at',
      sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;`,
    },
  ];

  for (const m of migrations) {
    // Check if column already exists
    const [exists] = await sql`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = ${m.table}
        AND column_name = ${m.column}
      LIMIT 1
    `;

    if (exists) {
      console.log(`⏭️  ${m.table}.${m.column} already exists, skipping`);
    } else {
      await sql.unsafe(m.sql);
      console.log(`✅ Added ${m.table}.${m.column}`);
    }
  }

  // Seed categories if table is empty
  const [catCount] = await sql`SELECT COUNT(*)::int as count FROM categories`;
  if (!catCount || catCount.count === 0) {
    const categories = [
      { name: 'Sports', slug: 'sports', description: 'Athletic competitions, teams, and players', sort_order: 1 },
      { name: 'Movies & TV', slug: 'movies-tv', description: 'Films, television shows, and streaming content', sort_order: 2 },
      { name: 'Technology', slug: 'tech', description: 'Software, hardware, gadgets, and innovation', sort_order: 3 },
      { name: 'Music', slug: 'music', description: 'Artists, albums, genres, and concerts', sort_order: 4 },
      { name: 'Gaming', slug: 'gaming', description: 'Video games, consoles, and esports', sort_order: 5 },
      { name: 'Politics & News', slug: 'politics-news', description: 'Current events, policy, and world affairs', sort_order: 6 },
      { name: 'Food & Drink', slug: 'food', description: 'Restaurants, recipes, cuisines, and beverages', sort_order: 7 },
      { name: 'Culture', slug: 'culture', description: 'Art, books, fashion, and lifestyle', sort_order: 8 },
      { name: 'Other', slug: 'other', description: 'Everything else that deserves a rating', sort_order: 9 },
    ];
    for (const cat of categories) {
      await sql`
        INSERT INTO categories (name, slug, description, sort_order)
        VALUES (${cat.name}, ${cat.slug}, ${cat.description}, ${cat.sort_order})
        ON CONFLICT (slug) DO NOTHING
      `;
    }
    console.log(`✅ Seeded ${categories.length} categories`);
  } else {
    console.log(`⏭️  Categories already seeded (${catCount.count} found)`);
  }

  console.log('\n🎉 Migration complete!');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
