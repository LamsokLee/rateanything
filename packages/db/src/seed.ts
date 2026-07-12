/**
 * Development seed script — populates the database with initial categories
 * and a test user for local development.
 *
 * Run with: npm run db:seed (from packages/db)
 */
import env from "@next/env";
import path from "path";
import { fileURLToPath } from "url";

// Load env from monorepo root (single source of truth)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../..");
const isDev = process.env.NODE_ENV !== "production";
env.loadEnvConfig(monorepoRoot, isDev);

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { categories, users } from './schema/index.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log('🌱 Seeding database...');

  // Seed categories
  const categoryData = [
    { name: 'Sports', slug: 'sports', description: 'Athletic competitions, teams, and players', sortOrder: 1 },
    { name: 'Movies & TV', slug: 'movies-tv', description: 'Films, television shows, and streaming content', sortOrder: 2 },
    { name: 'Technology', slug: 'tech', description: 'Software, hardware, gadgets, and innovation', sortOrder: 3 },
    { name: 'Music', slug: 'music', description: 'Artists, albums, genres, and concerts', sortOrder: 4 },
    { name: 'Gaming', slug: 'gaming', description: 'Video games, consoles, and esports', sortOrder: 5 },
    { name: 'Politics & News', slug: 'politics-news', description: 'Current events, policy, and world affairs', sortOrder: 6 },
    { name: 'Food & Drink', slug: 'food', description: 'Restaurants, recipes, cuisines, and beverages', sortOrder: 7 },
    { name: 'Culture', slug: 'culture', description: 'Art, books, fashion, and lifestyle', sortOrder: 8 },
    { name: 'Other', slug: 'other', description: 'Everything else that deserves a rating', sortOrder: 9 },
  ];

  await db.insert(categories).values(categoryData).onConflictDoNothing();
  console.log(`✅ Seeded ${categoryData.length} categories`);

  // Seed a test user (simulates a Clerk-synced user)
  const testUser = {
    clerkId: 'user_test_123456789',
    username: 'testuser',
    email: 'test@rateanything.dev',
    bio: 'Just a test user rating everything in sight.',
    location: 'San Francisco, CA',
    isVerified: true,
    isAdmin: true,
  };

  await db.insert(users).values(testUser).onConflictDoNothing();
  console.log('✅ Seeded test user');

  console.log('🎉 Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
