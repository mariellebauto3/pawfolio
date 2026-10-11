"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PostCard } from "@/components/data-display/post-card";
import { DropdownMenu, type MenuItem } from "@/components/overlays/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icon";
import { postPath } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { useReport } from "@/providers/report-provider";
import { useToast } from "@/providers/toast-provider";
import type { Post } from "@/types/post";
import { togglePostReaction } from "../api/feed";
import { useLike } from "../hooks/use-like";

type Props = {
  post: Post;
  /** "2h ago", written by whoever holds the list. */
  when: string;
  /** The signed-in account's id: their own posts get Edit and Delete. */
  viewerId: number;
  variant?: "feed" | "detail";
  /** Something about the post changed here: a like, or the count after it. */
  onPatch: (postId: number, patch: Partial<Post>) => void;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  /** On the post's own page, Comment moves to the comment box. On the feed it opens that page. */
  onComment?: () => void;
  /** The comments, on the post's own page. */
  children?: ReactNode;
  /** Heading level for the post's title, so it fits the page outline. */
  titleAs?: "h2" | "h3";
};

const ACTION = cn(
  "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control px-2 text-sm font-bold text-ink-muted no-underline",
  "transition-colors duration-200 ease-out hover:bg-surface-sunken hover:text-ink",
);

function ActionLabel({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <>
      <Icon name={icon} className="size-5 shrink-0" />
      {children}
    </>
  );
}

// One post with what can be done to it: Like, Comment and Share under it, and the ••• menu (FD-06) with Edit and
// Delete on the viewer's own posts, Copy link on every post, and Report on everyone else's: the post, or the
// account behind it (RP-01). The menu only offers what the API will accept, and the API checks again (SEC-FE-05).
export function FeedPost({ post, when, viewerId, variant = "feed", onPatch, onEdit, onDelete, onComment, children, titleAs }: Props) {
  const toast = useToast();
  const reporting = useReport();
  const mine = post.author.id === viewerId;
  const name = post.author.display_name;
  const like = useLike(
    post,
    () => togglePostReaction(api, post.id),
    ({ has_reacted, reactions_count }) => onPatch(post.id, { has_reacted, reactions_count }),
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(postPath(post.id), window.location.origin).href);
      toast.show("Link copied.");
    } catch {
      toast.show("We couldn't copy the link. Open the post and copy it from the address bar.", { tone: "error" });
    }
  }

  const items: MenuItem[] = [
    ...(mine
      ? ([
          { label: "Edit post", icon: "pencil", onSelect: () => onEdit(post) },
          { label: "Delete post", icon: "trash", destructive: true, onSelect: () => onDelete(post) },
          { type: "separator" },
        ] satisfies MenuItem[])
      : []),
    { label: "Copy link", icon: "link", onSelect: () => void copyLink() },
    // Nobody reports what is their own, and an admin's account can't be reported.
    ...(reporting && !mine && post.author.role !== "admin"
      ? ([
          { type: "separator" },
          { label: "Report post", icon: "flag", onSelect: () => reporting.report({ kind: "post", postId: post.id, ownerName: name }) },
          { label: "Report this account", icon: "user", onSelect: () => reporting.report({ kind: "account", accountId: post.author.id, ownerName: name }) },
        ] satisfies MenuItem[])
      : []),
  ];

  return (
    <PostCard
      post={post}
      when={when}
      variant={variant}
      titleAs={titleAs}
      menu={<DropdownMenu label={mine ? "Options for your post" : `Options for ${name}’s post`} icon="more" align="end" items={items} />}
      actions={
        <>
          <button type="button" aria-pressed={like.liked} aria-busy={like.pending || undefined} onClick={() => void like.toggle()} className={cn(ACTION, like.liked && "text-ink")}>
            {/* Liked is said three ways: the word, the filled heart and the pressed state. Never by colour alone. */}
            <Icon name="heart" className={cn("size-5 shrink-0", like.liked && "fill-accent text-accent-ink")} />
            {like.liked ? "Liked" : "Like"}
            <span className="sr-only">{mine ? " your post" : ` ${name}’s post`}</span>
          </button>
          {onComment ? (
            <button type="button" onClick={onComment} className={ACTION}>
              <ActionLabel icon="message-circle">Comment</ActionLabel>
            </button>
          ) : (
            <Link href={`${postPath(post.id)}#comments`} className={ACTION}>
              <ActionLabel icon="message-circle">Comment</ActionLabel>
              <span className="sr-only">{mine ? " on your post" : ` on ${name}’s post`}</span>
            </Link>
          )}
          <button type="button" onClick={() => void copyLink()} className={ACTION}>
            <ActionLabel icon="link">Share</ActionLabel>
            <span className="sr-only">{mine ? " your post" : ` ${name}’s post`}: copies its link</span>
          </button>
        </>
      }
    >
      {children}
    </PostCard>
  );
}
