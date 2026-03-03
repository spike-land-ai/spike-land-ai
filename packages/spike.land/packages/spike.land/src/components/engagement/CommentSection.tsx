"use client";

import { MessageSquare, Reply, Send, Trash2, User } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

interface CommentUser {
  id: string;
  name: string | null;
  image: string | null;
}

interface CommentData {
  id: string;
  body: string;
  user: CommentUser;
  parentId: string | null;
  replies: CommentData[];
  createdAt: string;
}

interface CommentSectionProps {
  contentType: "blog" | "app" | "docs";
  contentSlug: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  depth = 0,
}: {
  comment: CommentData;
  currentUserId: string | null;
  onDelete: (id: string) => void;
  onReply: (parentId: string) => void;
  depth?: number;
}) {
  const isOwn = currentUserId === comment.user.id;

  return (
    <div
      className={`flex flex-col gap-2 ${depth > 0 ? "ml-8 pl-4 border-l-2 border-primary/10" : ""}`}
    >
      <div className="group rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 hover:bg-white/[0.05] transition-colors">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0 overflow-hidden">
            {comment.user.image
              ? (
                <Image
                  src={comment.user.image}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-full object-cover"
                />
              )
              : <User className="h-3.5 w-3.5 text-primary/60" />}
          </div>
          <span className="text-sm font-semibold text-foreground">
            {comment.user.name ?? "Anonymous"}
          </span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(comment.createdAt)}
          </span>
        </div>

        {/* Body */}
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {comment.body}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {depth === 0 && (
            <button
              onClick={() => onReply(comment.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Reply className="h-3 w-3" />
              Reply
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.length > 0 && (
        <div className="flex flex-col gap-2">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Full comment section component with list, create, reply, and delete.
 * Supports blog, app, and docs content types.
 */
export function CommentSection(
  { contentType, contentSlug }: CommentSectionProps,
) {
  const [comments, setComments] = useState<CommentData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);

  // Check auth status
  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then((session: { user?: { id: string; }; }) => {
        if (session?.user?.id) {
          setCurrentUserId(session.user.id);
          setIsAuthed(true);
        }
      })
      .catch(() => {
        /* not authed */
      });
  }, []);

  // Load comments
  useEffect(() => {
    fetch(
      `/api/comments?contentType=${contentType}&slug=${encodeURIComponent(contentSlug)}`,
    )
      .then(r => r.json())
      .then(
        (data: { comments: CommentData[]; total: number; }) => {
          setComments(data.comments ?? []);
          setTotal(data.total ?? 0);
        },
      )
      .finally(() => setLoading(false));
  }, [contentType, contentSlug]);

  async function handleSubmit() {
    if (!body.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType,
          contentSlug,
          body: body.trim(),
          parentId: replyingTo ?? undefined,
        }),
      });

      if (res.ok) {
        const { comment } = await res.json() as { comment: CommentData; };

        if (replyingTo) {
          // Add reply to parent
          setComments(prev =>
            prev.map(c =>
              c.id === replyingTo
                ? { ...c, replies: [...(c.replies ?? []), comment] }
                : c
            )
          );
        } else {
          // Add top-level comment
          setComments(prev => [comment, ...prev]);
          setTotal(t => t + 1);
        }

        setBody("");
        setReplyingTo(null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (res.ok) {
      // Remove from top-level or from replies
      setComments(prev =>
        prev
          .filter(c => c.id !== id)
          .map(c => ({
            ...c,
            replies: (c.replies ?? []).filter(r => r.id !== id),
          }))
      );
      setTotal(t => Math.max(0, t - 1));
    }
  }

  return (
    <section className="mt-12 pt-8 border-t border-border/30">
      <div className="flex items-center gap-2 mb-6">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">
          Comments{total > 0 ? ` (${total})` : ""}
        </h3>
      </div>

      {/* Comment input */}
      {isAuthed
        ? (
          <div className="mb-8">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-2 text-xs text-primary">
                <Reply className="h-3 w-3" />
                <span>Replying to a comment</span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={replyingTo
                  ? "Write a reply..."
                  : "Share your thoughts..."}
                rows={3}
                className="flex-1 rounded-xl bg-white/[0.03] border border-white/10 focus:border-primary/40 p-3 text-sm text-foreground placeholder-muted-foreground/50 resize-none outline-none transition-colors"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || !body.trim()}
                className="self-end rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? "..." : "Post"}
              </button>
            </div>
          </div>
        )
        : (
          <div className="mb-8 rounded-xl bg-white/[0.03] border border-white/10 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              <a
                href="/auth/signin"
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </a>{" "}
              to join the conversation.
            </p>
          </div>
        )}

      {/* Comment list */}
      {loading
        ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="animate-pulse rounded-xl bg-white/[0.03] h-20"
              />
            ))}
          </div>
        )
        : comments.length === 0
        ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No comments yet. Be the first to share your thoughts!
          </p>
        )
        : (
          <div className="flex flex-col gap-3">
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                onDelete={handleDelete}
                onReply={setReplyingTo}
              />
            ))}
          </div>
        )}
    </section>
  );
}
