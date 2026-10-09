"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROUTES } from "@/constants/routes";
import { formatTimeAgo } from "@/lib/utils/format-date";
import { useReport } from "@/providers/report-provider";
import { useToast } from "@/providers/toast-provider";
import type { Post, PostComment, PostReply } from "@/types/post";
import { DeleteCommentDialog } from "../dialogs/delete-comment-dialog";
import { DeletePostDialog } from "../dialogs/delete-post-dialog";
import { PostDialog } from "../dialogs/post-dialog";
import { CommentForm } from "../forms/comment-form";
import { countLabel } from "../schemas/posts";
import type { FeedViewer, PostDetail, ReactionState } from "../types/feed";
import { CommentItem } from "./comment-item";
import { FeedPost } from "./feed-post";

type Props = {
  detail: PostDetail;
  viewer: FeedViewer;
  /** When the server rendered the page, so both sides write the same "2h ago" before anything changes. */
  renderedAt: string;
};

type Open = { kind: "edit" } | { kind: "delete" } | { kind: "delete-comment"; comment: PostReply; replies: number } | null;

const COMMENTS_ID = "comments";

// FD-05 Post detail & comments: the post in full with its likes, the comment box, and every comment with its
// replies, oldest first. What the viewer adds or removes shows here once the API has taken it, and the count under
// the post follows. Deleting the post leads back to the feed.
export function PostThread({ detail, viewer, renderedAt }: Props) {
  const router = useRouter();
  const toast = useToast();
  const reporting = useReport();
  const [post, setPost] = useState<Post>(detail);
  const [comments, setComments] = useState<PostComment[]>(detail.comments);
  const [open, setOpen] = useState<Open>(null);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [now, setNow] = useState(() => new Date(renderedAt));
  const commentBox = useRef<HTMLTextAreaElement>(null);
  const focusBoxOnClose = useRef(false);

  const when = (iso: string) => formatTimeAgo(iso, now);
  const ownsPost = post.author.id === viewer.id;

  // Opened from the feed's Comment button or comment count: the box is ready to type in.
  useEffect(() => {
    if (window.location.hash === `#${COMMENTS_ID}`) commentBox.current?.focus({ preventScroll: true });
  }, []);

  // A removed comment takes the button that had focus with it. The box gets focus once the dialog has closed: while
  // it is open, nothing behind it can be focused.
  useEffect(() => {
    if (open !== null || !focusBoxOnClose.current) return;
    focusBoxOnClose.current = false;
    commentBox.current?.focus({ preventScroll: true });
  }, [open]);

  function adjustCount(by: number) {
    setPost((current) => ({ ...current, comments_count: Math.max(current.comments_count + by, 0) }));
  }

  function handleAdded(comment: PostComment) {
    // Times are worked out again, so the new one reads "Just now" beside the others.
    setNow(new Date());
    adjustCount(1);
    if (comment.parent_comment_id === null) {
      setComments((list) => [...list, comment]);
      setStatus("Comment posted.");
      return;
    }
    setComments((list) => list.map((parent) => (parent.id === comment.parent_comment_id ? { ...parent, replies: [...parent.replies, comment] } : parent)));
    setReplyingTo(null);
    setStatus("Reply posted.");
  }

  function handleLiked(commentId: number, next: ReactionState) {
    setComments((list) =>
      list.map((comment) =>
        comment.id === commentId ? { ...comment, ...next } : { ...comment, replies: comment.replies.map((reply) => (reply.id === commentId ? { ...reply, ...next } : reply)) },
      ),
    );
  }

  function handleCommentDeleted(removed: PostReply) {
    const parent = comments.find((comment) => comment.id === removed.id);
    // A comment takes its replies off the page with it; the API counts the same way.
    adjustCount(-(1 + (parent?.replies.length ?? 0)));
    setComments((list) => list.filter((comment) => comment.id !== removed.id).map((comment) => ({ ...comment, replies: comment.replies.filter((reply) => reply.id !== removed.id) })));
    focusBoxOnClose.current = true;
    setOpen(null);
    setStatus(removed.parent_comment_id === null ? "Comment removed." : "Reply removed.");
  }

  const canDelete = (comment: PostReply) => ownsPost || comment.author.id === viewer.id;
  // Report on everyone else's comments (RP-01); nobody reports their own.
  const reportOf = (comment: PostReply) =>
    reporting && comment.author.id !== viewer.id && comment.author.role !== "admin"
      ? () => reporting.report({ kind: "comment", commentId: comment.id, ownerName: comment.author.display_name })
      : undefined;

  return (
    <>
      <FeedPost
        post={post}
        when={when(post.created_at)}
        viewerId={viewer.id}
        variant="detail"
        onPatch={(_, patch) => setPost((current) => ({ ...current, ...patch }))}
        onEdit={() => setOpen({ kind: "edit" })}
        onDelete={() => setOpen({ kind: "delete" })}
        onComment={() => commentBox.current?.focus()}
      >
        <section aria-labelledby={COMMENTS_ID} className="flex flex-col gap-4">
          <h2 id={COMMENTS_ID} className="text-lg">
            {post.comments_count === 0 ? "Comments" : countLabel(post.comments_count, "comment", "comments")}
          </h2>

          <CommentForm postId={post.id} viewer={viewer} onAdded={handleAdded} inputRef={commentBox} />

          {comments.length === 0 ? (
            <p className="text-sm text-ink-muted">No comments yet. Yours can be the first.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {comments.map((comment) => (
                <li key={comment.id}>
                  <CommentItem
                    comment={comment}
                    when={when(comment.created_at)}
                    onLike={(next) => handleLiked(comment.id, next)}
                    onReply={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    onDelete={canDelete(comment) ? () => setOpen({ kind: "delete-comment", comment, replies: comment.replies.length }) : undefined}
                    onReport={reportOf(comment)}
                  >
                    {(comment.replies.length > 0 || replyingTo === comment.id) && (
                      <div className="mt-1 flex flex-col gap-3">
                        {comment.replies.length > 0 && (
                          <ul aria-label={`Replies to ${comment.author.display_name}`} className="flex flex-col gap-3">
                            {comment.replies.map((reply) => (
                              <li key={reply.id}>
                                <CommentItem
                                  comment={reply}
                                  when={when(reply.created_at)}
                                  onLike={(next) => handleLiked(reply.id, next)}
                                  onDelete={canDelete(reply) ? () => setOpen({ kind: "delete-comment", comment: reply, replies: 0 }) : undefined}
                                  onReport={reportOf(reply)}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                        {replyingTo === comment.id && (
                          <CommentForm
                            postId={post.id}
                            viewer={viewer}
                            replyTo={{ id: comment.id, name: comment.author.display_name }}
                            onAdded={handleAdded}
                            onCancel={() => setReplyingTo(null)}
                            autoFocus
                          />
                        )}
                      </div>
                    )}
                  </CommentItem>
                </li>
              ))}
            </ul>
          )}

          <p role="status" className="sr-only">
            {status}
          </p>
        </section>
      </FeedPost>

      <PostDialog
        open={open?.kind === "edit"}
        onClose={() => setOpen(null)}
        mode="edit"
        viewer={viewer}
        post={post}
        onDone={(saved) => {
          setPost(saved);
          toast.show("Changes saved.");
        }}
      />

      <DeletePostDialog
        post={open?.kind === "delete" ? post : null}
        onClose={() => setOpen(null)}
        onDeleted={() => {
          toast.show("Post deleted.");
          router.push(ROUTES.memberHome);
        }}
      />

      <DeleteCommentDialog
        comment={open?.kind === "delete-comment" ? open.comment : null}
        replies={open?.kind === "delete-comment" ? open.replies : 0}
        own={open?.kind === "delete-comment" ? open.comment.author.id === viewer.id : false}
        onClose={() => setOpen(null)}
        onDeleted={handleCommentDeleted}
      />
    </>
  );
}
