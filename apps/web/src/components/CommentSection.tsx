"use client";

/**
 * CommentSection — Full threaded comment system for topic pages.
 * Features: create, reply (1-level nesting), upvote/downvote, sort by top/newest.
 * Requires auth to post or vote; shows login prompt when unauthenticated.
 */
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { CommentSkeleton } from "./Skeleton";

interface CommentUser {
  id: string;
  username: string | null;
}

interface CommentData {
  id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  createdAt: Date | string;
  user: CommentUser | null;
  userVote: "upvote" | "downvote" | null;
  /** Whether the current logged-in user owns this comment */
  isOwner: boolean;
  /** Whether this comment has been soft-deleted (tombstoned) */
  isDeleted: boolean;
  replies: (Omit<CommentData, "replies">)[];
}

interface CommentSectionProps {
  topicId: string;
}

function formatRelativeTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}

export function CommentSection({ topicId }: CommentSectionProps) {
  const { user } = useAuth();
  const [commentsList, setCommentsList] = useState<CommentData[]>([]);
  const [sort, setSort] = useState<"newest" | "top">("newest");
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchComments = useCallback(async (sortBy: "newest" | "top", append = false, pageCursor?: string) => {
    if (!append) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const params = new URLSearchParams();
      const input: Record<string, unknown> = { topicId, sort: sortBy, limit: 20 };
      if (pageCursor) input.cursor = pageCursor;
      params.set("input", JSON.stringify({ json: input }));

      const res = await fetch(`/api/trpc/comments.getForTopic?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const result = data.result?.data?.json;
        if (result) {
          if (append) {
            setCommentsList((prev) => [...prev, ...result.comments]);
          } else {
            setCommentsList(result.comments);
          }
          setCursor(result.nextCursor);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [topicId]);

  useEffect(() => {
    fetchComments(sort);
  }, [sort, fetchComments]);

  const handleSubmitComment = useCallback(async () => {
    if (!user || !newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/trpc/comments.create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: { topicId, content: newComment.trim() },
        }),
      });

      if (res.ok) {
        setNewComment("");
        // Refresh comments
        fetchComments(sort);
      }
    } catch {
      // Silently fail
    } finally {
      setIsSubmitting(false);
    }
  }, [user, newComment, isSubmitting, topicId, sort, fetchComments]);

  const handleSubmitReply = useCallback(async (parentId: string) => {
    if (!user || !replyContent.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/trpc/comments.create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: { topicId, content: replyContent.trim(), parentId },
        }),
      });

      if (res.ok) {
        setReplyContent("");
        setReplyTo(null);
        fetchComments(sort);
      }
    } catch {
      // Silently fail
    } finally {
      setIsSubmitting(false);
    }
  }, [user, replyContent, isSubmitting, topicId, sort, fetchComments]);

  const handleVote = useCallback(async (commentId: string, direction: "up" | "down") => {
    if (!user) return;

    const voteDirection = direction === "up" ? "upvote" : "downvote";

    // Compute optimistic update based on current vote state
    const applyOptimistic = (comment: { upvotes: number; downvotes: number; userVote: "upvote" | "downvote" | null }) => {
      const currentVote = comment.userVote;
      let { upvotes, downvotes } = comment;
      let newUserVote: "upvote" | "downvote" | null;

      if (currentVote === voteDirection) {
        // Toggle off: remove existing vote
        if (voteDirection === "upvote") upvotes--;
        else downvotes--;
        newUserVote = null;
      } else if (currentVote !== null) {
        // Switch direction: remove old, add new
        if (currentVote === "upvote") upvotes--;
        else downvotes--;
        if (voteDirection === "upvote") upvotes++;
        else downvotes++;
        newUserVote = voteDirection;
      } else {
        // New vote
        if (voteDirection === "upvote") upvotes++;
        else downvotes++;
        newUserVote = voteDirection;
      }

      return { upvotes, downvotes, userVote: newUserVote };
    };

    // Optimistic update
    setCommentsList((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const updated = applyOptimistic(c);
          return { ...c, ...updated };
        }
        return {
          ...c,
          replies: c.replies.map((r) => {
            if (r.id === commentId) {
              const updated = applyOptimistic(r);
              return { ...r, ...updated };
            }
            return r;
          }),
        };
      })
    );

    const endpoint = direction === "up" ? "comments.upvote" : "comments.downvote";
    try {
      const res = await fetch(`/api/trpc/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ json: { commentId } }),
      });

      if (res.ok) {
        // Apply server-authoritative counts
        const data = await res.json();
        const result = data.result?.data?.json;
        if (result) {
          setCommentsList((prev) =>
            prev.map((c) => {
              if (c.id === commentId) {
                return { ...c, upvotes: result.upvotes, downvotes: result.downvotes, userVote: result.userVote };
              }
              return {
                ...c,
                replies: c.replies.map((r) => {
                  if (r.id === commentId) {
                    return { ...r, upvotes: result.upvotes, downvotes: result.downvotes, userVote: result.userVote };
                  }
                  return r;
                }),
              };
            })
          );
        }
      } else {
        // Revert on error by refetching
        fetchComments(sort);
      }
    } catch {
      // Revert on error by refetching
      fetchComments(sort);
    }
  }, [user, sort, fetchComments]);

  /** Delete comment handler — calls comments.remove mutation, then refreshes */
  const handleDelete = useCallback(async (commentId: string) => {
    if (!user) return;
    // Confirm before deleting
    if (!window.confirm("Delete this comment?")) return;

    try {
      const res = await fetch("/api/trpc/comments.remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ json: { commentId } }),
      });

      if (res.ok) {
        // Refresh comments to show tombstone or removal
        fetchComments(sort);
      } else {
        console.error("[CommentSection] Delete failed:", res.status);
      }
    } catch (err) {
      console.error("[CommentSection] Delete error:", err);
    }
  }, [user, sort, fetchComments]);

  return (
    <section className="border border-border/60 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground/80">Discussion</h2>
        <div className="flex items-center gap-1 rounded bg-muted/80 p-0.5 border border-input/50">
          <button
            onClick={() => setSort("top")}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              sort === "top"
                ? "bg-muted-foreground text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Top
          </button>
          <button
            onClick={() => setSort("newest")}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              sort === "newest"
                ? "bg-muted-foreground text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Newest
          </button>
        </div>
      </div>

      {/* Comment input */}
      {user ? (
        <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your take..."
            maxLength={500}
            className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-subtle resize-none focus:outline-none focus:border-subtle transition-colors"
            rows={3}
          />
          <div className="flex justify-end">
            <button
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
              className="rounded bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-input/50 bg-muted/30 px-4 py-3 text-center text-xs text-muted-foreground">
          Log in to join the discussion
        </div>
      )}

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CommentSkeleton key={i} />
          ))}
        </div>
      ) : commentsList.length === 0 ? (
        <p className="text-center text-xs text-subtle py-4">
          No comments yet. Be the first to share your take.
        </p>
      ) : (
        <div className="space-y-3">
          {commentsList.map((comment) => (
            <div key={comment.id} className="space-y-2">
              {/* Top-level comment */}
              <CommentCard
                comment={comment}
                user={user}
                onVote={handleVote}
                onReply={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                onDelete={handleDelete}
              />

              {/* Replies — always rendered even if parent is deleted (Reddit behavior) */}
              {comment.replies.length > 0 && (
                <div className="ml-3 sm:ml-6 space-y-2 border-l border-border pl-2 sm:pl-3">
                  {comment.replies.map((reply) => (
                    <CommentCard
                      key={reply.id}
                      comment={reply}
                      user={user}
                      onVote={handleVote}
                      onDelete={handleDelete}
                      isReply
                    />
                  ))}
                </div>
              )}

              {/* Reply input */}
              {replyTo === comment.id && user && (
                <div className="ml-3 sm:ml-6 space-y-2">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write a reply..."
                    maxLength={500}
                    className="w-full rounded-lg border border-input bg-muted/50 px-3 py-2 text-xs text-foreground placeholder-subtle resize-none focus:outline-none focus:border-subtle transition-colors"
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setReplyTo(null); setReplyContent(""); }}
                      className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSubmitReply(comment.id)}
                      disabled={!replyContent.trim() || isSubmitting}
                      className="rounded bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      Reply
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {cursor && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => fetchComments(sort, true, cursor)}
            disabled={isLoadingMore}
            className="rounded bg-muted border border-input px-4 py-2 text-xs font-medium text-foreground/80 hover:bg-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </section>
  );
}

/** Individual comment card — handles tombstone rendering for deleted comments */
function CommentCard({
  comment,
  user,
  onVote,
  onReply,
  onDelete,
  isReply = false,
}: {
  comment: {
    id: string;
    content: string;
    upvotes: number;
    downvotes: number;
    createdAt: Date | string;
    user: CommentUser | null;
    userVote?: "upvote" | "downvote" | null;
    isOwner: boolean;
    isDeleted: boolean;
  };
  user: { id: string; username: string | null } | null;
  onVote: (commentId: string, direction: "up" | "down") => void;
  onReply?: () => void;
  onDelete?: (commentId: string) => void;
  isReply?: boolean;
}) {
  const netScore = comment.upvotes - comment.downvotes;

  // Tombstone rendering: show muted "[deleted]" content, hide interactive controls
  if (comment.isDeleted) {
    return (
      <div className={`rounded-lg border border-border/40 bg-card/50 p-3 opacity-60 ${isReply ? "text-xs" : "text-sm"}`}>
        <div className="flex items-center gap-2 mb-1.5">
          {/* Deleted author placeholder */}
          <span className={`font-medium text-muted-foreground italic ${isReply ? "text-[11px]" : "text-xs"}`}>
            [deleted]
          </span>
          <span className="text-[10px] text-subtle/70">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        {/* Deleted content rendered muted/italic */}
        <p className={`text-muted-foreground/70 italic leading-relaxed mb-2 ${isReply ? "text-[11px]" : "text-xs"}`}>
          [deleted]
        </p>
        {/* No vote buttons, reply button, or delete button for tombstoned comments */}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border/40 bg-card/80 p-3 ${isReply ? "text-xs" : "text-sm"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`font-medium text-foreground/80 ${isReply ? "text-[11px]" : "text-xs"}`}>
          {comment.user?.username ?? "Anonymous"}
        </span>
        <span className="text-[10px] text-subtle/70">
          {formatRelativeTime(comment.createdAt)}
        </span>
      </div>
      <p className={`text-muted-foreground leading-relaxed mb-2 ${isReply ? "text-[11px]" : "text-xs"}`}>
        {comment.content}
      </p>
      <div className="flex items-center gap-3">
        {/* Upvote */}
        <button
          onClick={() => user && onVote(comment.id, "up")}
          disabled={!user}
          className={`flex items-center gap-1 text-[11px] transition-colors disabled:cursor-default disabled:hover:text-subtle ${comment.userVote === "upvote" ? "text-green-400" : "text-subtle hover:text-green-400"}`}
          aria-label="Upvote"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
          </svg>
          <span className="font-mono">{comment.upvotes}</span>
        </button>
        {/* Downvote */}
        <button
          onClick={() => user && onVote(comment.id, "down")}
          disabled={!user}
          className={`flex items-center gap-1 text-[11px] transition-colors disabled:cursor-default disabled:hover:text-subtle ${comment.userVote === "downvote" ? "text-red-400" : "text-subtle hover:text-red-400"}`}
          aria-label="Downvote"
        >
          <svg className="w-3.5 h-3.5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
          </svg>
          <span className="font-mono">{comment.downvotes}</span>
        </button>
        {/* Net score */}
        <span className={`text-[10px] font-mono ${netScore > 0 ? "text-green-500" : netScore < 0 ? "text-red-500" : "text-subtle/70"}`}>
          {netScore > 0 ? "+" : ""}{netScore}
        </span>
        {/* Reply button */}
        {onReply && user && (
          <button
            onClick={onReply}
            className="text-[11px] text-subtle hover:text-foreground/80 transition-colors ml-auto"
          >
            Reply
          </button>
        )}
        {/* Delete button — shown only for comment owner on non-deleted comments */}
        {comment.isOwner && onDelete && (
          <button
            onClick={() => onDelete(comment.id)}
            className={`text-[11px] text-subtle hover:text-red-400 transition-colors ${!onReply || !user ? "ml-auto" : ""}`}
            aria-label="Delete comment"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
