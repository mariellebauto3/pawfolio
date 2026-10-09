"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { authorProfilePath } from "@/constants/posts";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format-date";
import type { PostReply } from "@/types/post";
import { toggleCommentReaction } from "../api/feed";
import { useLike } from "../hooks/use-like";
import type { ReactionState } from "../types/feed";

type Props = {
  comment: PostReply;
  /** "2h ago", written by the thread. */
  when: string;
  onLike: (next: ReactionState) => void;
  /** Opens the reply box under this comment. Left out on a reply: replies go one level deep. */
  onReply?: () => void;
  /** Shown to the comment's author, and to the author of the post it is on. */
  onDelete?: () => void;
  /** The replies and the reply box, indented under the comment. */
  children?: ReactNode;
};

// 44 px tall on a phone, tighter from md up, like the small buttons.
const ACTION = "inline-flex min-h-11 items-center gap-1.5 rounded-control px-2 text-sm font-bold text-ink-muted transition-colors duration-200 ease-out hover:text-primary md:min-h-8";

// One comment or reply on a post's page (FD-05): who said it and when, the words, then Like, Reply and Delete. The
// words and the name come from people and are rendered as text only (SEC-FE-01). Report joins these actions with the
// Reports module (RP-01).
export function CommentItem({ comment, when, onLike, onReply, onDelete, children }: Props) {
  const { author } = comment;
  const profilePath = authorProfilePath(author);
  const like = useLike(comment, () => toggleCommentReaction(api, comment.id), onLike);

  return (
    <div className="flex items-start gap-3">
      <Avatar name={author.display_name} src={author.avatar_url ?? undefined} alt="" size="sm" className="mt-1" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="rounded-card bg-surface-sunken px-3 py-2">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            {profilePath ? (
              <Link href={profilePath} className="text-sm font-bold text-ink no-underline wrap-break-word hover:text-primary hover:underline">
                {author.display_name}
              </Link>
            ) : (
              <span className="text-sm font-bold wrap-break-word">{author.display_name}</span>
            )}
            <time dateTime={comment.created_at} title={formatDateTime(comment.created_at)} className="text-xs text-ink-muted">
              {when}
            </time>
          </p>
          <p className="text-sm wrap-break-word whitespace-pre-line">{comment.body}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-1">
          <button type="button" aria-pressed={like.liked} aria-busy={like.pending || undefined} onClick={() => void like.toggle()} className={cn(ACTION, like.liked && "text-ink")}>
            <Icon name="heart" className={cn("size-4 shrink-0", like.liked && "fill-accent text-accent-ink")} />
            {like.liked ? "Liked" : "Like"}
            {like.count > 0 && <span className="font-normal tabular-nums">{like.count}</span>}
            <span className="sr-only">
              {like.count > 0 && (like.count === 1 ? " like" : " likes")}: {author.display_name}’s comment
            </span>
          </button>
          {onReply && (
            <button type="button" onClick={onReply} className={ACTION}>
              Reply
              <span className="sr-only"> to {author.display_name}</span>
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className={ACTION}>
              Delete
              <span className="sr-only"> {author.display_name}’s comment</span>
            </button>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
