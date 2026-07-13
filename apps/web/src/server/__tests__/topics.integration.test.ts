/**
 * Integration tests for the topics router.
 * Covers: create, getBySlug, addOption, trending, search, byCategory, ratingHistory
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDb, createTestCaller, TEST_USERS } from "@/test/helpers";
import {
  db, sql, topics, options, ratings, users, categories,
  eq, and, asc,
} from "@rateanything/db";

beforeEach(resetDb);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a topic with given options, returns { id, slug } */
async function createTopic(
  caller: Awaited<ReturnType<typeof createTestCaller>>,
  overrides: {
    title?: string;
    categoryId?: number;
    description?: string;
    options?: { name: string; description?: string }[];
  } = {}
) {
  const title = overrides.title ?? "Default Test Topic";
  const opts = overrides.options ?? [{ name: "Option A" }, { name: "Option B" }];
  return caller.topics.create({
    title,
    categoryId: overrides.categoryId ?? 1, // Sports
    description: overrides.description,
    options: opts,
  });
}

/** Get a topic row directly from DB */
async function getTopicRow(topicId: string) {
  const [row] = await db.select().from(topics).where(eq(topics.id, topicId)).limit(1);
  return row ?? null;
}

/** Get options for a topic from DB */
async function getOptionsForTopic(topicId: string) {
  return db
    .select()
    .from(options)
    .where(eq(options.topicId, topicId))
    .orderBy(asc(options.sortOrder));
}

// ─── topics.create ────────────────────────────────────────────────────────────

describe("topics.create", () => {
  it("rejects title shorter than 5 characters", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      createTopic(caller, { title: "ABCD" }) // 4 chars
    ).rejects.toThrow();
  });

  it("accepts title with exactly 5 characters", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "ABCDE" }); // 5 chars
    expect(result.slug).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it("accepts title with exactly 100 characters", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const title = "A".repeat(100);
    const result = await createTopic(caller, { title });
    expect(result.slug).toBeDefined();
  });

  it("rejects title with 101 characters", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const title = "A".repeat(101);
    await expect(createTopic(caller, { title })).rejects.toThrow();
  });

  it("rejects only 1 option", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.topics.create({
        title: "Single Option Topic",
        categoryId: 1,
        options: [{ name: "Only One" }],
      })
    ).rejects.toThrow();
  });

  it("accepts exactly 2 options", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, {
      title: "Two Options Topic",
      options: [{ name: "First" }, { name: "Second" }],
    });
    expect(result.id).toBeDefined();
  });

  it("accepts exactly 20 options", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const opts = Array.from({ length: 20 }, (_, i) => ({ name: `Option ${i + 1}` }));
    const result = await createTopic(caller, {
      title: "Twenty Options Topic",
      options: opts,
    });
    expect(result.id).toBeDefined();
    const dbOptions = await getOptionsForTopic(result.id);
    expect(dbOptions).toHaveLength(20);
  });

  it("rejects 21 options", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const opts = Array.from({ length: 21 }, (_, i) => ({ name: `Option ${i + 1}` }));
    await expect(
      createTopic(caller, { title: "TwentyOne Options", options: opts })
    ).rejects.toThrow();
  });

  it("rejects empty option name", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      createTopic(caller, {
        title: "Empty Option Name",
        options: [{ name: "" }, { name: "Valid" }],
      })
    ).rejects.toThrow();
  });

  // NOTE: Zod schema says .max(200) but the actual DB column is varchar(100).
  // Testing the actual DB limit of 100 chars. Values 101-200 pass Zod but fail on insert.
  // BUG: Zod/Drizzle schema mismatch — options.name says varchar(200)/max(200) but DB is varchar(100).
  it("accepts option name with exactly 100 characters (actual DB limit)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const longName = "X".repeat(100);
    const result = await createTopic(caller, {
      title: "Long Option Name Test",
      options: [{ name: longName }, { name: "Short" }],
    });
    const dbOptions = await getOptionsForTopic(result.id);
    expect(dbOptions.some((o) => o.name === longName)).toBe(true);
  });

  it("rejects option name with 201 characters (exceeds Zod max)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const tooLong = "X".repeat(201);
    await expect(
      createTopic(caller, {
        title: "TooLong Option Name",
        options: [{ name: tooLong }, { name: "Fine" }],
      })
    ).rejects.toThrow();
  });

  // NOTE: PRODUCT.md and the Zod schema (topicCreateInputSchema) allow description up to 2000 chars,
  // but the actual database column is varchar(500). The Zod validation passes but the DB insert fails.
  // This is a schema-vs-DB mismatch. Testing the actual DB limit (500).
  it("accepts description within the actual DB limit (500 chars)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const desc = "D".repeat(500);
    const result = await createTopic(caller, {
      title: "Max Desc Five Hundred",
      description: desc,
    });
    const row = await getTopicRow(result.id);
    expect(row!.description).toBe(desc);
  });

  // BUG: Zod schema allows .max(2000) for description, but the DB column is varchar(500).
  // Values between 501-2000 pass Zod validation but throw a Postgres error on insert.
  it("rejects description exceeding 2001 chars at Zod level", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const desc = "D".repeat(2001);
    await expect(
      createTopic(caller, { title: "Too Long Desc Topic", description: desc })
    ).rejects.toThrow();
  });

  it("requires authentication (guest cannot create)", async () => {
    const guest = await createTestCaller(null);
    await expect(
      guest.topics.create({
        title: "Guest Topic Attempt",
        categoryId: 1,
        options: [{ name: "A" }, { name: "B" }],
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("auto-generates unique slugs for same-title topics (both persisted)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const title = "Duplicate Title Topic";

    const result1 = await createTopic(caller, { title });
    const result2 = await createTopic(caller, { title });

    expect(result1.slug).not.toBe(result2.slug);

    // Both are persisted
    const row1 = await getTopicRow(result1.id);
    const row2 = await getTopicRow(result2.id);
    expect(row1).not.toBeNull();
    expect(row2).not.toBeNull();

    // Slug length: base slug (up to 120 via slugify) + '-' + 6 random chars = max ~127
    expect(result1.slug.length).toBeLessThanOrEqual(130);
    expect(result2.slug.length).toBeLessThanOrEqual(130);
  });

  // NOTE: The Drizzle schema defines allowNewOptions with default(true), but the actual DB
  // column defaults to false. Asserting actual DB behavior.
  it("stores allowNewOptions as false by default (actual DB default)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "AllowOpts Default" });
    const row = await getTopicRow(result.id);
    expect(row!.allowNewOptions).toBe(false);
  });

  it("returns slug in the create response", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "Return Slug Test" });
    expect(result.slug).toBeDefined();
    expect(typeof result.slug).toBe("string");
    expect(result.slug.length).toBeGreaterThan(0);
  });

  it("created topic is retrievable via getBySlug", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "Retrievable Topic" });
    const fetched = await caller.topics.getBySlug({ slug: result.slug });
    expect(fetched.title).toBe("Retrievable Topic");
    expect(fetched.id).toBe(result.id);
    expect(fetched.options).toHaveLength(2);
  });
});

// ─── topics.getBySlug ─────────────────────────────────────────────────────────

describe("topics.getBySlug", () => {
  it("returns topic with its options", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, {
      title: "GetBySlug Basic Test",
      options: [{ name: "Alpha" }, { name: "Beta" }, { name: "Gamma" }],
    });

    const fetched = await caller.topics.getBySlug({ slug: result.slug });
    expect(fetched.title).toBe("GetBySlug Basic Test");
    expect(fetched.slug).toBe(result.slug);
    expect(fetched.options).toHaveLength(3);
    expect(fetched.options[0].name).toBe("Alpha");
    expect(fetched.options[1].name).toBe("Beta");
    expect(fetched.options[2].name).toBe("Gamma");
    expect(fetched.category).not.toBeNull();
    expect(fetched.category!.slug).toBe("sports");
    expect(fetched.creator).not.toBeNull();
    expect(fetched.creator!.username).toBe("reguser");
  });

  it("includes userRating for authed caller who rated", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "UserRating Test" });
    const opts = await getOptionsForTopic(result.id);

    // Submit a rating on the first option
    await caller.ratings.submit({ optionId: opts[0].id, score: 8 });

    const fetched = await caller.topics.getBySlug({ slug: result.slug });
    expect(fetched.options[0].userRating).toBe(8);
    expect(fetched.options[1].userRating).toBeNull();
  });

  it("returns null userRating for guest caller", async () => {
    const authed = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(authed, { title: "Guest Rating View" });
    const opts = await getOptionsForTopic(result.id);

    // Authed user rates
    await authed.ratings.submit({ optionId: opts[0].id, score: 7 });

    // Guest views — should not see userRating
    const guest = await createTestCaller(null);
    const fetched = await guest.topics.getBySlug({ slug: result.slug });
    expect(fetched.options[0].userRating).toBeNull();
    expect(fetched.options[1].userRating).toBeNull();
  });

  it("throws NOT_FOUND for non-existent slug", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.topics.getBySlug({ slug: "nonexistent-slug-xyz123" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─── topics.addOption ─────────────────────────────────────────────────────────

describe("topics.addOption", () => {
  it("adds a new option when allowNewOptions is true", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "AddOpt Allowed Topic" });

    // NOTE: allowNewOptions defaults to false in the DB, so we must enable it explicitly
    await db
      .update(topics)
      .set({ allowNewOptions: true })
      .where(eq(topics.id, result.id));

    const newOpt = await caller.topics.addOption({
      topicId: result.id,
      name: "New Option Added",
    });
    expect(newOpt.name).toBe("New Option Added");
    expect(newOpt.topicId).toBe(result.id);
    expect(newOpt.id).toBeDefined();

    const dbOpts = await getOptionsForTopic(result.id);
    expect(dbOpts).toHaveLength(3); // 2 original + 1 new
  });

  it("enforces option name min(1) — rejects empty name", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "AddOpt Empty Name" });
    await db.update(topics).set({ allowNewOptions: true }).where(eq(topics.id, result.id));

    await expect(
      caller.topics.addOption({ topicId: result.id, name: "" })
    ).rejects.toThrow();
  });

  // NOTE: Zod says .max(200), DB column is varchar(100). Testing actual DB limit.
  it("enforces option name bounds (100 chars actual DB limit, 201 rejected by Zod)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "AddOpt Max Name" });
    await db.update(topics).set({ allowNewOptions: true }).where(eq(topics.id, result.id));

    // 100 should work (actual DB column limit)
    const okName = "Y".repeat(100);
    const opt = await caller.topics.addOption({ topicId: result.id, name: okName });
    expect(opt.name).toBe(okName);

    // 201 should fail at Zod level
    const tooLong = "Y".repeat(201);
    await expect(
      caller.topics.addOption({ topicId: result.id, name: tooLong })
    ).rejects.toThrow();
  });

  it("rejects adding option when allowNewOptions is false (FORBIDDEN)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "AddOpt Closed Topic" });
    // allowNewOptions already defaults to false, but be explicit
    const row = await getTopicRow(result.id);
    expect(row!.allowNewOptions).toBe(false);

    await expect(
      caller.topics.addOption({ topicId: result.id, name: "Should Fail" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires authentication (guest cannot add option)", async () => {
    const authed = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(authed, { title: "AddOpt Auth Req" });

    const guest = await createTestCaller(null);
    await expect(
      guest.topics.addOption({ topicId: result.id, name: "Guest Opt" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── topics.trending ──────────────────────────────────────────────────────────

describe("topics.trending", () => {
  // NOTE: PRODUCT.md documents trending as "24-hour velocity" but the actual code uses:
  // total_ratings::real / POWER(EXTRACT(EPOCH FROM (NOW() - last_activity)) / 3600.0 + 2, 1.5)
  // This is a time-decay formula based on total_ratings and hours since last_activity, NOT a 24h velocity.

  it("returns topics ordered by effective trending score descending", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);

    // Create topics with different totalRatings to influence trending
    const t1 = await createTopic(caller, { title: "Trending Low Score" });
    const t2 = await createTopic(caller, { title: "Trending High Score" });

    // Rate t2 more to give it a higher trending score
    const t2Opts = await getOptionsForTopic(t2.id);
    await caller.ratings.submit({ optionId: t2Opts[0].id, score: 9 });
    await caller.ratings.submit({ optionId: t2Opts[1].id, score: 8 });

    const trending = await caller.topics.trending({ limit: 10 });
    expect(trending.topics.length).toBeGreaterThanOrEqual(2);

    // t2 should appear before t1 since it has more ratings
    const t2Idx = trending.topics.findIndex((t) => t.id === t2.id);
    const t1Idx = trending.topics.findIndex((t) => t.id === t1.id);
    expect(t2Idx).toBeLessThan(t1Idx);
  });

  it("uses default limit of 20 when not specified", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    // Create 22 topics
    for (let i = 0; i < 22; i++) {
      await createTopic(caller, { title: `Trending Limit ${i.toString().padStart(2, "0")}` });
    }

    const trending = await caller.topics.trending({});
    expect(trending.topics.length).toBe(20);
    expect(trending.nextCursor).not.toBeNull();
  });

  it("respects max limit cap of 50", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.topics.trending({ limit: 51 })
    ).rejects.toThrow();
  });

  it("supports cursor-based pagination", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    // Create 5 topics
    for (let i = 0; i < 5; i++) {
      await createTopic(caller, { title: `Trending Page ${i}` });
    }

    const page1 = await caller.topics.trending({ limit: 3 });
    expect(page1.topics.length).toBe(3);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.topics.trending({ limit: 3, cursor: page1.nextCursor! });
    expect(page2.topics.length).toBe(2);

    // No overlap
    const page1Ids = new Set(page1.topics.map((t) => t.id));
    for (const t of page2.topics) {
      expect(page1Ids.has(t.id)).toBe(false);
    }
  });
});

// ─── topics.search ────────────────────────────────────────────────────────────

describe("topics.search", () => {
  // NOTE: PRODUCT.md §search mentions pg_trgm fuzzy search, but the actual implementation
  // uses ILIKE (case-insensitive substring match), NOT trigram similarity scoring.
  // The trigram GIN index exists in the schema for future use, but the query uses `ILIKE '%query%'`.

  it("matches topics by substring (case-insensitive ILIKE)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await createTopic(caller, { title: "Amazing JavaScript Framework" });
    await createTopic(caller, { title: "Boring Python Library" });
    await createTopic(caller, { title: "Cool Typescript Tools" });

    // Search for "script" should match JavaScript and Typescript (case-insensitive)
    const results = await caller.topics.search({ query: "script" });
    expect(results.topics.length).toBe(2);
    const titles = results.topics.map((t) => t.title);
    expect(titles).toContain("Amazing JavaScript Framework");
    expect(titles).toContain("Cool Typescript Tools");
  });

  it("excludes non-matching topics", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await createTopic(caller, { title: "Unique Zephyr Topic" });
    await createTopic(caller, { title: "Another Normal Topic" });

    const results = await caller.topics.search({ query: "Zephyr" });
    expect(results.topics.length).toBe(1);
    expect(results.topics[0].title).toBe("Unique Zephyr Topic");
  });

  it("is case-insensitive (ILIKE behavior)", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await createTopic(caller, { title: "UPPERCASE TOPIC TITLE" });

    const results = await caller.topics.search({ query: "uppercase" });
    expect(results.topics.length).toBe(1);
    expect(results.topics[0].title).toBe("UPPERCASE TOPIC TITLE");
  });

  it("supports pagination with cursor", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    for (let i = 0; i < 5; i++) {
      await createTopic(caller, { title: `Searchable Item ${i}` });
    }

    const page1 = await caller.topics.search({ query: "Searchable", limit: 3 });
    expect(page1.topics.length).toBe(3);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.topics.search({
      query: "Searchable",
      limit: 3,
      cursor: page1.nextCursor!,
    });
    expect(page2.topics.length).toBe(2);

    // No overlap
    const page1Ids = new Set(page1.topics.map((t) => t.id));
    for (const t of page2.topics) {
      expect(page1Ids.has(t.id)).toBe(false);
    }
  });

  it("rejects query shorter than 2 characters", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.topics.search({ query: "X" })
    ).rejects.toThrow();
  });
});

// ─── topics.byCategory ────────────────────────────────────────────────────────

describe("topics.byCategory", () => {
  it("returns only topics in the given category", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await createTopic(caller, { title: "Sports Topic One", categoryId: 1 }); // Sports
    await createTopic(caller, { title: "Music Topic One", categoryId: 4 }); // Music
    await createTopic(caller, { title: "Sports Topic Two", categoryId: 1 }); // Sports

    const results = await caller.topics.byCategory({ slug: "sports" });
    expect(results.topics.length).toBe(2);
    expect(results.category.slug).toBe("sports");
    expect(results.topics.every((t) => t.categorySlug === "sports")).toBe(true);
  });

  it("supports pagination with cursor", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    for (let i = 0; i < 5; i++) {
      await createTopic(caller, { title: `Cat Page Topic ${i}`, categoryId: 3 }); // Technology
    }

    const page1 = await caller.topics.byCategory({ slug: "tech", limit: 3 });
    expect(page1.topics.length).toBe(3);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await caller.topics.byCategory({
      slug: "tech",
      limit: 3,
      cursor: page1.nextCursor!,
    });
    expect(page2.topics.length).toBe(2);

    // No overlap
    const page1Ids = new Set(page1.topics.map((t) => t.id));
    for (const t of page2.topics) {
      expect(page1Ids.has(t.id)).toBe(false);
    }
  });

  it("throws NOT_FOUND for unknown category slug", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    await expect(
      caller.topics.byCategory({ slug: "nonexistent-category-slug" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns empty topics array for category with no topics", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    // Gaming (id=5) has no topics
    const results = await caller.topics.byCategory({ slug: "gaming" });
    expect(results.topics).toHaveLength(0);
    expect(results.category.slug).toBe("gaming");
    expect(results.nextCursor).toBeNull();
  });
});

// ─── topics.ratingHistory ─────────────────────────────────────────────────────

describe("topics.ratingHistory", () => {
  it("returns history data points reflecting submitted ratings", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, {
      title: "History Chart Topic",
      options: [{ name: "Hist Opt A" }, { name: "Hist Opt B" }],
    });
    const opts = await getOptionsForTopic(result.id);

    // Submit ratings
    await caller.ratings.submit({ optionId: opts[0].id, score: 8 });
    await caller.ratings.submit({ optionId: opts[1].id, score: 5 });

    const history = await caller.topics.ratingHistory({ topicId: result.id });
    expect(history.options).toHaveLength(2);
    expect(history.options[0].optionId).toBe(opts[0].id);
    expect(history.options[0].optionName).toBe("Hist Opt A");
    expect(history.options[1].optionId).toBe(opts[1].id);
    expect(history.options[1].optionName).toBe("Hist Opt B");

    // Each option should have at least 1 history data point
    expect(history.options[0].history.length).toBeGreaterThanOrEqual(1);
    expect(history.options[1].history.length).toBeGreaterThanOrEqual(1);

    // Verify shape of history data points
    const point = history.options[0].history[0];
    expect(point).toHaveProperty("timestamp");
    expect(point).toHaveProperty("avgScore");
    expect(point).toHaveProperty("count");
    expect(typeof point.avgScore).toBe("number");
    expect(typeof point.count).toBe("number");

    // avgScore should reflect the submitted rating
    expect(point.avgScore).toBe(8);
    expect(point.count).toBe(1);
  });

  it("returns empty history for options with no ratings", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "No Ratings History" });

    const history = await caller.topics.ratingHistory({ topicId: result.id });
    expect(history.options).toHaveLength(2);
    expect(history.options[0].history).toHaveLength(0);
    expect(history.options[1].history).toHaveLength(0);
  });

  it("returns empty options array for non-existent topic", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const history = await caller.topics.ratingHistory({
      topicId: "00000000-0000-0000-0000-000000000000",
    });
    expect(history.options).toHaveLength(0);
  });

  it("supports hour bucket size", async () => {
    const caller = await createTestCaller(TEST_USERS.regular.clerkId);
    const result = await createTopic(caller, { title: "Hour Bucket Topic" });
    const opts = await getOptionsForTopic(result.id);

    await caller.ratings.submit({ optionId: opts[0].id, score: 6 });

    const history = await caller.topics.ratingHistory({
      topicId: result.id,
      bucketSize: "hour",
    });
    expect(history.options[0].history.length).toBeGreaterThanOrEqual(1);
    expect(history.options[0].history[0].avgScore).toBe(6);
  });
});
