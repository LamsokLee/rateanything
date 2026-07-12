/**
 * Production database setup script.
 * Standalone — doesn't depend on project modules.
 * Run: DATABASE_URL=your-url node scripts/prod-setup.js
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

  // Create tables
  console.log("Creating tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      color VARCHAR(7) DEFAULT '#3b82f6',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      clerk_id VARCHAR(255) UNIQUE,
      username VARCHAR(50) NOT NULL,
      email VARCHAR(255) UNIQUE,
      display_name VARCHAR(100),
      bio TEXT,
      avatar_url TEXT,
      location VARCHAR(100),
      website TEXT,
      is_admin BOOLEAN DEFAULT FALSE,
      reputation INT DEFAULT 0,
      rating_count INT DEFAULT 0,
      follower_count INT DEFAULT 0,
      following_count INT DEFAULT 0,
      last_seen_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS topics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      image_url TEXT,
      source_url TEXT,
      category_id INT REFERENCES categories(id),
      creator_id UUID REFERENCES users(id),
      status VARCHAR(20) DEFAULT 'active',
      allow_new_options BOOLEAN DEFAULT FALSE,
      total_ratings INT DEFAULT 0,
      total_votes INT DEFAULT 0,
      trending_score FLOAT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      last_activity TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      description TEXT,
      image_url TEXT,
      sort_order INT DEFAULT 0,
      avg_rating FLOAT DEFAULT 0,
      rating_count INT DEFAULT 0,
      total_score INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      option_id UUID NOT NULL REFERENCES options(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      guest_fingerprint VARCHAR(255),
      score INT NOT NULL CHECK (score >= 1 AND score <= 10),
      comment TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(option_id, user_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id),
      parent_id UUID REFERENCES comments(id),
      content TEXT NOT NULL,
      upvotes INT DEFAULT 0,
      downvotes INT DEFAULT 0,
      score INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS follows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      follower_id UUID NOT NULL REFERENCES users(id),
      following_id UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(follower_id, following_id)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(200) NOT NULL,
      content TEXT,
      actor_id UUID REFERENCES users(id),
      topic_id UUID REFERENCES topics(id),
      comment_id UUID REFERENCES comments(id),
      read_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_id UUID REFERENCES topics(id),
      comment_id UUID REFERENCES comments(id),
      user_id UUID REFERENCES users(id),
      reporter_id UUID NOT NULL REFERENCES users(id),
      reason VARCHAR(50) NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      resolved_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS badges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      icon VARCHAR(50),
      earned_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  console.log("✅ Tables created.");

  // Seed categories
  const categories = [
    { name: "Tech", slug: "tech", color: "#3b82f6" },
    { name: "Food", slug: "food", color: "#f97316" },
    { name: "Sports", slug: "sports", color: "#22c55e" },
    { name: "Culture", slug: "culture", color: "#a855f7" },
    { name: "Movies & TV", slug: "movies-tv", color: "#ec4899" },
    { name: "Gaming", slug: "gaming", color: "#8b5cf6" },
    { name: "Politics & News", slug: "politics-news", color: "#ef4444" },
    { name: "Music", slug: "music", color: "#fbbf24" },
  ];

  for (const cat of categories) {
    await sql`
      INSERT INTO categories (name, slug, color, sort_order)
      VALUES (${cat.name}, ${cat.slug}, ${cat.color}, 0)
      ON CONFLICT (slug) DO NOTHING
    `;
  }
  console.log(`✅ Seeded ${categories.length} categories.`);

  // Seed demo topics
  const [techCat] = await sql`SELECT id FROM categories WHERE slug = 'tech'`;
  const [foodCat] = await sql`SELECT id FROM categories WHERE slug = 'food'`;

  if (techCat) {
    const [topic] = await sql`
      INSERT INTO topics (title, slug, description, category_id, status, total_ratings, total_votes, trending_score)
      VALUES (
        'Best Programming Language for 2026',
        'best-programming-language-2026-abc123',
        'What is the best language to learn and use in 2026?',
        ${techCat.id},
        'active',
        0, 0, 0
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `;

    if (topic) {
      const opts = ["Python", "Rust", "TypeScript", "Go"];
      for (let i = 0; i < opts.length; i++) {
        await sql`
          INSERT INTO options (topic_id, name, sort_order, avg_rating, rating_count)
          VALUES (${topic.id}, ${opts[i]}, ${i}, 0, 0)
        `;
      }
      console.log("✅ Created topic: Best Programming Language for 2026");
    }
  }

  if (foodCat) {
    const [topic] = await sql`
      INSERT INTO topics (title, slug, description, category_id, status, total_ratings, total_votes, trending_score)
      VALUES (
        'Greatest Pizza Topping',
        'greatest-pizza-topping-xyz789',
        'The eternal debate. What belongs on pizza?',
        ${foodCat.id},
        'active',
        0, 0, 0
      )
      ON CONFLICT (slug) DO NOTHING
      RETURNING id
    `;

    if (topic) {
      const opts = ["Pepperoni", "Mushrooms", "Pineapple", "Anchovies"];
      for (let i = 0; i < opts.length; i++) {
        await sql`
          INSERT INTO options (topic_id, name, sort_order, avg_rating, rating_count)
          VALUES (${topic.id}, ${opts[i]}, ${i}, 0, 0)
        `;
      }
      console.log("✅ Created topic: Greatest Pizza Topping");
    }
  }

  console.log("\n🎉 Database setup complete!");
  await sql.end();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
