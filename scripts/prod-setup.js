/**
 * Production database setup / patch script — idempotent for both fresh and existing DBs.
 * Standalone — doesn't depend on project modules.
 *
 * Run: DATABASE_URL=your-url node scripts/prod-setup.js
 *
 * This script:
 * 1. Creates tables if they don't exist (for new DBs)
 * 2. Adds missing columns if tables already exist (for existing DBs)
 * 3. Seeds categories if empty
 *
 * Safe to run multiple times — only adds what's missing, never destructive.
 */
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is required");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = postgres(databaseUrl, {
    ssl: { rejectUnauthorized: false },
    prepare: false,
  });

  // Enable extensions
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  console.log("✅ pg_trgm extension ready");

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
  console.log("✅ Enum types ready");

  // ============================================
  // CREATE TABLES (for fresh DBs)
  // ============================================
  console.log("Creating tables if missing...");

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_id VARCHAR(255) NOT NULL UNIQUE,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      bio VARCHAR(500),
      location VARCHAR(100),
      is_verified BOOLEAN DEFAULT FALSE,
      is_admin BOOLEAN DEFAULT FALSE,
      reputation INTEGER DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      follower_count INTEGER DEFAULT 0,
      following_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS guests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      fingerprint_hash VARCHAR(64) NOT NULL UNIQUE,
      ip_address VARCHAR(45),
      user_agent TEXT,
      rating_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      slug VARCHAR(220) NOT NULL UNIQUE,
      description TEXT,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      image_url TEXT,
      source_url TEXT,
      creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
      status topic_status DEFAULT 'active',
      allow_new_options BOOLEAN DEFAULT TRUE,
      total_ratings INTEGER DEFAULT 0,
      trending_score FLOAT DEFAULT 0,
      is_pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      closed_at TIMESTAMP WITH TIME ZONE,
      last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      avg_rating FLOAT DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      rating_sum BIGINT DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
      score SMALLINT NOT NULL,
      comment TEXT,
      tags TEXT[],
      is_edited BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      CONSTRAINT chk_ratings_rater CHECK (
        (user_id IS NOT NULL AND guest_id IS NULL) OR (user_id IS NULL AND guest_id IS NOT NULL)
      )
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rating_id UUID REFERENCES ratings(id) ON DELETE CASCADE,
      topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
      content VARCHAR(500) NOT NULL,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      score INTEGER DEFAULT 0,
      is_deleted BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id),
      CONSTRAINT chk_follows_no_self CHECK (follower_id != following_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
      target_type report_target_type NOT NULL,
      target_id UUID NOT NULL,
      reason VARCHAR(100) NOT NULL,
      details TEXT,
      status report_status DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      resolved_at TIMESTAMP WITH TIME ZONE
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS badges (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      icon VARCHAR(50),
      criteria JSONB
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_badges (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
      awarded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, badge_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS comment_votes (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      vote VARCHAR(10) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, comment_id)
    );
  `;

  console.log("✅ Tables created/verified.");

  // ============================================
  // ADD MISSING COLUMNS (for existing DBs)
  // ============================================
  console.log("Patching existing tables with missing columns...");

  const patches = [
    // options table
    { table: 'options', column: 'rating_sum', sql: `ALTER TABLE options ADD COLUMN IF NOT EXISTS rating_sum bigint NOT NULL DEFAULT 0;` },
    // comments table
    { table: 'comments', column: 'is_deleted', sql: `ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;` },
    { table: 'comments', column: 'rating_id', sql: `ALTER TABLE comments ADD COLUMN IF NOT EXISTS rating_id uuid REFERENCES ratings(id) ON DELETE CASCADE;` },
    // users table
    { table: 'users', column: 'updated_at', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;` },
  ];

  for (const patch of patches) {
    const [exists] = await sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = ${patch.table} AND column_name = ${patch.column}
      LIMIT 1
    `;
    if (exists) {
      console.log(`  ⏭️  ${patch.table}.${patch.column} already exists`);
    } else {
      await sql.unsafe(patch.sql);
      console.log(`  ✅ Added ${patch.table}.${patch.column}`);
    }
  }

  // ============================================
  // CREATE INDEXES (idempotent)
  // ============================================
  console.log("Creating indexes...");
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_topics_category_trending ON topics(category_id, trending_score)`,
    `CREATE INDEX IF NOT EXISTS idx_topics_created_at ON topics(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_topics_status ON topics(status) WHERE status = 'active'`,
    `CREATE INDEX IF NOT EXISTS idx_topics_trgm ON topics USING GIN (title gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS idx_options_topic ON options(topic_id, sort_order)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_options_topic_name ON options(topic_id, name)`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_option_created ON ratings(option_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ratings_guest ON ratings(guest_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_ratings_user_option ON ratings(user_id, option_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_ratings_guest_option ON ratings(guest_id, option_id)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_rating ON comments(rating_id, upvotes)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_user_created ON comments(user_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_comments_topic_drizzle ON comments(topic_id, upvotes)`,
    `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status) WHERE status = 'pending'`,
    `CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)`,
  ];

  for (const idx of indexes) {
    await sql.unsafe(idx);
  }
  console.log("✅ Indexes created/verified.");

  // ============================================
  // SEED CATEGORIES (idempotent)
  // ============================================
  const [catCount] = await sql`SELECT COUNT(*)::int as count FROM categories`;
  if (!catCount || catCount.count === 0) {
    const categories = [
      { name: 'Sports', slug: 'sports', description: 'Athletic competitions, teams, and players', sort_order: 1 },
      { name: 'Movies \u0026 TV', slug: 'movies-tv', description: 'Films, television shows, and streaming content', sort_order: 2 },
      { name: 'Technology', slug: 'tech', description: 'Software, hardware, gadgets, and innovation', sort_order: 3 },
      { name: 'Music', slug: 'music', description: 'Artists, albums, genres, and concerts', sort_order: 4 },
      { name: 'Gaming', slug: 'gaming', description: 'Video games, consoles, and esports', sort_order: 5 },
      { name: 'Politics \u0026 News', slug: 'politics-news', description: 'Current events, policy, and world affairs', sort_order: 6 },
      { name: 'Food \u0026 Drink', slug: 'food', description: 'Restaurants, recipes, cuisines, and beverages', sort_order: 7 },
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
    console.log(`✅ Seeded ${categories.length} categories.`);
  } else {
    console.log(`⏭️  Categories already seeded (${catCount.count} found).`);
  }

  console.log("\n🎉 Database setup/patch complete!");
  await sql.end();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
