"use client";

/**
 * UserActivityTabs — Accessible tabs wrapper for user profile activity sections.
 * Renders Votes, Comments, and Topics tabs with proper ARIA attributes and keyboard navigation.
 */
import { useState, useCallback, useEffect, type KeyboardEvent } from "react";
import Link from "next/link";
import { useMode } from "./ModeProvider";
import { UserRatingHistory } from "./UserRatingHistory";
import { UserCommentHistory } from "./UserCommentHistory";

interface RatingHistoryItem {
  topicTitle: string;
  topicSlug: string;
  optionName: string;
  score: number;
  createdAt: Date | string;
}

interface CommentHistoryItem {
  id: string;
  content: string;
  topicTitle: string;
  topicSlug: string;
  score: number;
  createdAt: Date | string;
}

interface CreatedTopicItem {
  id: string;
  title: string;
  slug: string;
  totalRatings: number;
  createdAt: Date | string;
  categoryName: string | null;
  categorySlug: string | null;
}

interface UserActivityTabsProps {
  username: string;
  initialRatingItems: RatingHistoryItem[];
  initialRatingCursor: string | null;
  initialCommentItems: CommentHistoryItem[];
  initialCommentCursor: string | null;
  initialCreatedTopics: CreatedTopicItem[];
}

const TABS = [
  { id: "votes", label: "Votes" },
  { id: "comments", label: "Comments" },
  { id: "topics", label: "Topics" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function UserActivityTabs({
  username,
  initialRatingItems,
  initialRatingCursor,
  initialCommentItems,
  initialCommentCursor,
  initialCreatedTopics,
}: UserActivityTabsProps) {
  const { mode } = useMode();
  const availableTabs = mode === "arena" ? TABS.filter((t) => t.id !== "votes") : TABS;
  const [activeTab, setActiveTab] = useState<TabId>("votes");

  useEffect(() => {
    if (mode === "arena" && activeTab === "votes") {
      setActiveTab("comments");
    }
  }, [mode, activeTab]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = availableTabs.findIndex((t) => t.id === activeTab);
      let newIndex = currentIndex;

      if (e.key === "ArrowRight") {
        newIndex = (currentIndex + 1) % availableTabs.length;
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        newIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
        e.preventDefault();
      } else if (e.key === "Home") {
        newIndex = 0;
        e.preventDefault();
      } else if (e.key === "End") {
        newIndex = availableTabs.length - 1;
        e.preventDefault();
      }

      if (newIndex !== currentIndex) {
        setActiveTab(availableTabs[newIndex].id);
        // Focus the new tab button
        const tabEl = document.getElementById(`tab-${availableTabs[newIndex].id}`);
        tabEl?.focus();
      }
    },
    [activeTab, availableTabs]
  );

  return (
    <div>
      {/* Tab list */}
      <div
        role="tablist"
        aria-label="User activity"
        className="flex border-b border-border/60 mb-4"
      >
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={handleKeyDown}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {mode === "rate" && (
        <div
          id="tabpanel-votes"
          role="tabpanel"
          aria-labelledby="tab-votes"
          hidden={activeTab !== "votes"}
        >
          {activeTab === "votes" && (
            initialRatingItems.length > 0 ? (
              <UserRatingHistory
                initialItems={initialRatingItems}
                initialCursor={initialRatingCursor}
                username={username}
              />
            ) : (
              <p className="text-sm text-subtle">No votes yet.</p>
            )
          )}
        </div>
      )}

      <div
        id="tabpanel-comments"
        role="tabpanel"
        aria-labelledby="tab-comments"
        hidden={activeTab !== "comments"}
      >
        {activeTab === "comments" && (
          <UserCommentHistory
            initialItems={initialCommentItems}
            initialCursor={initialCommentCursor}
            username={username}
          />
        )}
      </div>

      <div
        id="tabpanel-topics"
        role="tabpanel"
        aria-labelledby="tab-topics"
        hidden={activeTab !== "topics"}
      >
        {activeTab === "topics" && (
          initialCreatedTopics.length > 0 ? (
            <ul className="space-y-3">
              {initialCreatedTopics.map((topic) => (
                <li key={topic.id}>
                  <Link
                    href={`/topic/${topic.slug}`}
                    className="block border border-border rounded-lg p-3 hover:border-subtle transition-colors bg-card"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {topic.categoryName && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                          {topic.categoryName}
                        </span>
                      )}
                      {mode === "rate" && (
                        <span className="text-[11px] text-subtle font-mono">
                          {topic.totalRatings} votes
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                      {topic.title}
                    </h3>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-subtle">No topics created yet.</p>
          )
        )}
      </div>
    </div>
  );
}
