/**
 * Homepage — hero section + trending topics in 2-column grid with category tabs.
 */
import { getServerCaller } from "@/lib/server-trpc";
import { TopicFeed } from "@/components/TopicFeed";
import Link from "next/link";
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
      <Link
        href="/?mode=arena"
        className="block border border-border/60 rounded-xl bg-card/60 p-4 hover:border-accent/60 hover:bg-accent/5 transition-all duration-200 group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">⚔️</span>
          <div>
            <h2 className="text-sm font-semibold text-foreground group-hover:text-accent-foreground transition-colors">
              Try Arena Mode
            </h2>
            <p className="text-xs text-muted-foreground">
              Pick a topic and vote head-to-head — which option is better?
            </p>
          </div>
        </div>
      </Link>

      <TopicFeed topics={topics} categories={categoriesList} />
    </div>
  );
}
