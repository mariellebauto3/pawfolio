"use client";

import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { api } from "@/lib/api/client";
import type { Post } from "@/types/post";
import { deletePost } from "../api/feed";
import { countLabel } from "../schemas/posts";

type Props = {
  /** The post to delete; null keeps the dialog closed. */
  post: Post | null;
  onClose: () => void;
  /** The post is deleted and the dialog has closed. The caller takes it off the screen and confirms with a toast. */
  onDeleted: (post: Post) => void;
};

// FD-07 Delete post: asked before the viewer's own post is deleted, saying what goes with it. The API decides whose
// post it is (SEC-FE-05); a post someone else already removed counts as deleted.
export function DeletePostDialog({ post, onClose, onDeleted }: Props) {
  if (!post) return null;

  const reactions = post.reactions_count > 0 ? countLabel(post.reactions_count, "like", "likes") : null;
  const comments = post.comments_count > 0 ? countLabel(post.comments_count, "comment", "comments") : null;
  const lost = [reactions, comments].filter(Boolean).join(" and ");

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title="Delete this post?"
      confirmLabel="Delete post"
      cancelLabel="Keep post"
      destructive
      permanent
      consequences={[
        "The post leaves the feed, and its link stops working.",
        lost ? `Removed with it: ${lost}.` : "Nobody has liked or commented on it yet, so nothing else is lost.",
      ]}
      onConfirm={async () => {
        await deletePost(api, post.id);
        onDeleted(post);
      }}
    />
  );
}
