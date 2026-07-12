"use client";

import { useState } from "react";
import Link from "next/link";
import { TopicCard } from "@/components/TopicCard";

interface Topic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  totalRatings: number;
  trendingScore: number | null;
  categoryName: string | null;
  categorySlug: string | null;
  creatorUsername: string | null;
  createdAt: Date | string;
  topOptions?: { name: string; avgRating: number }[];
  optionCount?: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface TopicFeedProps {
  topics: Topic[];
  categories: Category[];
}

const TAB_COLORS: Record<string, string> = {
  sports: "#22c55e",
  "movies-tv": "#ec4899",
  tech: "#3b82f6",
  music: "#fbbf24",
  gaming: "#8b5cf6",
  "politics-news": "#ef4444",
  food: "#f97316",
  culture: "#a855f7",
};

export function TopicFeed({ topics, categories }: TopicFeedProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredTopics = activeCategory
    ? topics.filter((t) => t.categorySlug === activeCategory)
    : topics;

  const activeColor = activeCategory
    ? TAB_COLORS[activeCategory] ?? "#a1a1aa"
    : "#a1a1aa";

  const activeCategoryName = activeCategory
    ? categories.find((c) => c.slug === activeCategory)?.name ?? "Trending"
    : "Trending";

  return (
    <div className="space-y-5">
      {/* Category tabs — text links with colored underline indicator (#11) */}
      <div className="sticky top-[57px] z-40 bg-background/95 backdrop-blur-sm border-b border-border/50 -mx-4 px-4">
        <nav className="flex items-center gap-5 overflow-x-auto scrollbar-hide py-3" role="tablist">
          <button
            role="tab"
            aria-selected={activeCategory === null}
            onClick={() => setActiveCategory(null)}
            className={`relative shrink-0 text-[13px] font-medium transition-colors duration-150 pb-2 ${
              activeCategory === null
                ? "text-foreground font-semibold"
                : "text-subtle hover:text-foreground/80"
            }`}
          >
            All
            {activeCategory === null && (
              <span
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                style={{ backgroundColor: "#a1a1aa" }}
              />
            )}
          </button>
          {categories.map((cat) => {
            const isActive = activeCategory === cat.slug;
            const tabColor = TAB_COLORS[cat.slug] ?? "#a1a1aa";
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCategory(cat.slug)}
                className={`relative shrink-0 text-[13px] font-medium transition-colors duration-150 pb-2 ${
                  isActive
                    ? "text-foreground font-semibold"
                    : "text-subtle hover:text-foreground/80"
                }`}
              >
                {cat.name}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                    style={{ backgroundColor: tabColor }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Count header + category link */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-subtle">
            {activeCategoryName}
          </span>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold font-mono"
            style={{ background: `${activeColor}1f`, color: activeColor }}
          >
            {filteredTopics.length}
          </span>
        </div>
        {activeCategory && (
          <Link
            href={`/category/${activeCategory}`}
            className="text-[11px] text-accent hover:text-accent transition-colors"
          >
            View all →
          </Link>
        )}
      </div>

      {filteredTopics.length === 0 && (
        <div className="border border-border rounded-lg bg-card p-8 text-center">
          <p className="text-sm text-subtle">No topics in this category yet.</p>
          {activeCategory && (
            <Link
              href={`/category/${activeCategory}`}
              className="text-sm text-accent hover:text-accent mt-2 inline-block transition-colors"
            >
              View all in {activeCategoryName}
            </Link>
          )}
        </div>
      )}

      {/* 2-column grid — first card is featured (spans full width, taller) (#4) */}
      {filteredTopics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredTopics.map((topic, idx) => (
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
