"use client";

/**
 * UserActivityTabs — Accessible tabs wrapper for user profile activity sections.
 * Renders Votes and Comments tabs with proper ARIA attributes and keyboard navigation.
 */
import { useState, useCallback, type KeyboardEvent } from "react";
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

interface UserActivityTabsProps {
  username: string;
  initialRatingItems: RatingHistoryItem[];
  initialRatingCursor: string | null;
  initialCommentItems: CommentHistoryItem[];
  initialCommentCursor: string | null;
}

const TABS = [
  { id: "votes", label: "Votes" },
  { id: "comments", label: "Comments" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function UserActivityTabs({
  username,
  initialRatingItems,
  initialRatingCursor,
  initialCommentItems,
  initialCommentCursor,
}: UserActivityTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("votes");

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = TABS.findIndex((t) => t.id === activeTab);
      let newIndex = currentIndex;

      if (e.key === "ArrowRight") {
        newIndex = (currentIndex + 1) % TABS.length;
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        newIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        e.preventDefault();
      } else if (e.key === "Home") {
        newIndex = 0;
        e.preventDefault();
      } else if (e.key === "End") {
        newIndex = TABS.length - 1;
        e.preventDefault();
      }

      if (newIndex !== currentIndex) {
        setActiveTab(TABS[newIndex].id);
        // Focus the new tab button
        const tabEl = document.getElementById(`tab-${TABS[newIndex].id}`);
        tabEl?.focus();
      }
    },
    [activeTab]
  );

  return (
    <div>
      {/* Tab list */}
      <div
        role="tablist"
        aria-label="User activity"
        className="flex border-b border-border/60 mb-4"
      >
        {TABS.map((tab) => (
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
    </div>
  );
}
