/**
 * Category page — shows topics filtered by category slug.
 * Reuses the TopicCard component for consistent layout.
 */
import { notFound } from "next/navigation";
import { getServerCaller } from "@/lib/server-trpc";
import { TopicCard } from "@/components/TopicCard";
import Link from "next/link";

interface CategoryPageProps {
  params: { slug: string };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = params;

  let result: Awaited<
    ReturnType<Awaited<ReturnType<typeof getServerCaller>>["topics"]["byCategory"]>
  > | null = null;

  try {
    const caller = await getServerCaller();
    result = await caller.topics.byCategory({ slug, limit: 50 });
  } catch {
    notFound();
  }

  if (!result) {
    notFound();
  }

  const { category, topics } = result;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-subtle">
        <Link href="/" className="hover:text-foreground/80 transition-colors">
          Home
        </Link>
        <span>&rsaquo;</span>
        <span className="text-foreground/80 font-medium">{category.name}</span>
      </nav>

      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-foreground title-editorial">
          {category.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {topics.length} topic{topics.length !== 1 ? "s" : ""} in this category
        </p>
      </header>

      {topics.length === 0 ? (
        <div className="border border-border rounded-lg bg-card p-8 text-center">
          <p className="text-sm text-subtle">
            No topics in this category yet. Be the first to create one!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topics.map((topic, idx) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              featured={idx === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
