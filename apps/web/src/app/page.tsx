/**
 * Homepage — hero section + trending topics in 2-column grid with category tabs.
 */
import { getServerCaller } from "@/lib/server-trpc";
import { TopicFeed } from "@/components/TopicFeed";
import { ArenaCta } from "@/components/ArenaCta";
import { db, categories as categoriesTable, asc } from "@rateanything/db";

export default async function HomePage() {
  let topics: Awaited<ReturnType<Awaited<ReturnType<typeof getServerCaller>>["topics"]["trending"]>>["topics"] = [];
  let categoriesList: { id: number; name: string; slug: string }[] = [];
  let error: string | null = null;

  try {
    const caller = await getServerCaller();
    const result = await caller.topics.trending({ limit: 50 });
    topics = result.topics;

    // Fetch categories directly
    categoriesList = await db
      .select({ id: categoriesTable.id, name: categoriesTable.name, slug: categoriesTable.slug })
      .from(categoriesTable)
      .orderBy(asc(categoriesTable.id));

    // Exclude "Other" from category tabs
    categoriesList = categoriesList.filter((c) => c.slug !== "other");
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load topics";
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          Something went wrong: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <header className="pt-2 pb-4 space-y-1">
        <h1 className="text-2xl font-bold text-foreground title-editorial">
          What&apos;s your take?
        </h1>
        <p className="text-sm text-muted-foreground">
          Rate anything. See where you stand.
        </p>
      </header>

      {/* ─── ARENA CTA ─── */}
      <ArenaCta />

      <TopicFeed topics={topics} categories={categoriesList} />
    </div>
  );
}
