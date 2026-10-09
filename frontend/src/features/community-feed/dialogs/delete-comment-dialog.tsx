"use client";

import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { api } from "@/lib/api/client";
import type { PostReply } from "@/types/post";
import { deleteComment } from "../api/feed";
import { countLabel } from "../schemas/posts";

type Props = {
  /** The comment or reply to delete; null keeps the dialog closed. */
  comment: PostReply | null;
  /** How many replies sit under it: they leave the page with it. */
  replies: number;
  /** Whether the viewer wrote it. The author of the post may also remove what others wrote under it. */
  own: boolean;
  onClose: () => void;
  onDeleted: (comment: PostReply) => void;
};

// Asked before a comment is removed (FD-05). The API decides who may: its author, or the author of the post it is
// on (SEC-FE-05). One that is already gone counts as removed.
export function DeleteCommentDialog({ comment, replies, own, onClose, onDeleted }: Props) {
  if (!comment) return null;

  const isReply = comment.parent_comment_id !== null;
  const noun = isReply ? "reply" : "comment";

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={own ? `Delete your ${noun}?` : `Remove ${comment.author.display_name}’s ${noun}?`}
      confirmLabel={own ? `Delete ${noun}` : `Remove ${noun}`}
      cancelLabel={`Keep ${noun}`}
      destructive
      permanent
      consequences={replies > 0 ? [`Its ${countLabel(replies, "reply leaves", "replies leave")} the post with it.`] : undefined}
      onConfirm={async () => {
        await deleteComment(api, comment.id);
        onDeleted(comment);
      }}
    >
      <p className="rounded-card bg-surface-sunken px-4 py-3 text-sm wrap-break-word whitespace-pre-line">{comment.body}</p>
    </ConfirmDialog>
  );
}
