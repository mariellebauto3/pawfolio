"use client";

import { type FormEvent, type Ref, useId, useState } from "react";
import { Textarea } from "@/components/forms/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { PostComment } from "@/types/post";
import { addComment } from "../api/feed";
import { COMMENT_BODY_MAX, commentProblem } from "../schemas/posts";
import type { FeedViewer } from "../types/feed";

type Props = {
  postId: number;
  viewer: FeedViewer;
  /** The comment being replied to. Left out, this is a comment on the post itself. */
  replyTo?: { id: number; name: string };
  /** It is posted. The form has emptied itself; the caller shows the new comment. */
  onAdded: (comment: PostComment) => void;
  /** Shows Cancel, for a reply box that was opened and can be put away. */
  onCancel?: () => void;
  /** The box itself, so the post's Comment button can move to it. */
  inputRef?: Ref<HTMLTextAreaElement>;
  /** For a reply box: it was just asked for, so typing starts in it. */
  autoFocus?: boolean;
};

const UNKNOWN_PROBLEM = "We couldn't post that. Check your connection and try again.";

// The comment box under a post, and the reply box under a comment (FD-05). What is typed stays until the API has
// taken it, so a refusal loses nothing. The words are sent as text and shown as text (SEC-FE-01); the API trims and
// checks them again.
export function CommentForm({ postId, viewer, replyTo, onAdded, onCancel, inputRef, autoFocus }: Props) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const errorId = `${baseId}-error`;
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label = replyTo ? `Reply to ${replyTo.name}` : "Add a comment";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = commentProblem(text);
    setProblem(found);
    if (found) return;

    setBusy(true);
    try {
      const comment = await addComment(api, postId, text, replyTo?.id);
      setText("");
      onAdded(comment);
    } catch (failure) {
      if (!isApiError(failure)) setProblem(UNKNOWN_PROBLEM);
      else if (failure.kind === "validation") setProblem(failure.fieldErrors.body ?? failure.fieldErrors.parent_comment_id ?? failure.message);
      else if (failure.kind === "not_found") setProblem(replyTo ? "That comment isn’t there any more." : "This post isn’t available any more.");
      else setProblem(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex items-start gap-3">
      <Avatar name={viewer.name} src={viewer.avatarUrl ?? undefined} alt="" size="sm" className="mt-1.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <Textarea
          ref={inputRef}
          id={inputId}
          name="body"
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={COMMENT_BODY_MAX}
          showCount={false}
          autoFocus={autoFocus}
          placeholder={replyTo ? `Reply to ${replyTo.name}…` : viewer.role === "pet" ? `Add a comment, ${viewer.name}…` : "Add a comment…"}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? errorId : undefined}
          disabled={busy}
        />
        {problem && (
          <p id={errorId} role="alert" className="text-sm font-bold text-danger">
            {problem}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {onCancel && (
            <Button variant="tertiary" size="sm" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant={replyTo ? "secondary" : "primary"} size="sm" loading={busy} loadingLabel={replyTo ? "Posting your reply" : "Posting your comment"}>
            {replyTo ? "Reply" : "Post comment"}
          </Button>
        </div>
      </div>
    </form>
  );
}
