"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { EmptyState } from "@/components/feedback/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { formatTimeAgo } from "@/lib/utils/format-date";
import { useToast } from "@/providers/toast-provider";
import type { Post } from "@/types/post";
import { getFeed } from "../api/feed";
import { DeletePostDialog } from "../dialogs/delete-post-dialog";
import { PostDialog } from "../dialogs/post-dialog";
import type { FeedPage, FeedViewer, StoryPet } from "../types/feed";
import { FeedPost } from "./feed-post";

type Props = {
  /** The first page, as the server read it. */
  initial: FeedPage;
  viewer: FeedViewer;
  /** The pets this human adopted. Empty for a pet, and for a human who isn't a Furparent: no adoption story to write. */
  storyPets: StoryPet[];
  /** Opens the adoption story form straight away: the way in from an alumni profile or an adoption's details. */
  compose?: "story";
  /** When the server rendered the page, so both sides write the same "2h ago" before anything changes. */
  renderedAt: string;
};

type Open = { kind: "post" } | { kind: "story" } | { kind: "edit"; post: Post } | { kind: "delete"; post: Post } | null;

const UNKNOWN_PROBLEM = "We couldn't load more posts. Check your connection and try again.";

// FD-01 and FD-02, the community feed: the composer, then one list of everyone's posts, newest first, with more of
// it a press away. What the viewer posts, edits or deletes shows here once the API has taken it. Pets are spoken to
// by name and write in first person (ui-guidelines §7).
export function Feed({ initial, viewer, storyPets, compose, renderedAt }: Props) {
  const toast = useToast();
  const [posts, setPosts] = useState(initial.posts);
  const [page, setPage] = useState(initial.page);
  const [lastPage, setLastPage] = useState(initial.lastPage);
  const [loading, setLoading] = useState(false);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const canTellStory = viewer.role === "human" && storyPets.length > 0;
  const [open, setOpen] = useState<Open>(compose === "story" && canTellStory ? { kind: "story" } : null);
  const [now, setNow] = useState(() => new Date(renderedAt));
  const composer = useRef<HTMLButtonElement>(null);
  const focusComposerOnClose = useRef(false);

  // The address that opened the story form has done its job: a reload shouldn't open it again. Only the address
  // changes; nothing is asked of the server for it.
  useEffect(() => {
    if (compose) window.history.replaceState(null, "", ROUTES.memberHome);
  }, [compose]);

  // A deleted post takes the button that had focus with it. The composer gets focus once the dialog has closed:
  // while it is open, nothing behind it can be focused.
  useEffect(() => {
    if (open !== null || !focusComposerOnClose.current) return;
    focusComposerOnClose.current = false;
    composer.current?.focus({ preventScroll: true });
  }, [open]);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    setLoadProblem(null);
    try {
      const next = await getFeed(api, { page: page + 1 });
      setNow(new Date());
      // Posts made since the first page was read push older ones down a page: one already on screen isn't shown twice.
      setPosts((shown) => [...shown, ...next.posts.filter((post) => !shown.some((other) => other.id === post.id))]);
      setPage(next.page);
      setLastPage(next.lastPage);
    } catch (problem) {
      setLoadProblem(isApiError(problem) ? problem.message : UNKNOWN_PROBLEM);
    } finally {
      setLoading(false);
    }
  }

  function handlePosted(post: Post, said: string) {
    setNow(new Date());
    setPosts((shown) => [post, ...shown.filter((other) => other.id !== post.id)]);
    toast.show(said);
  }

  function handleSaved(saved: Post) {
    setPosts((shown) => shown.map((post) => (post.id === saved.id ? saved : post)));
    toast.show("Changes saved.");
  }

  function handleDeleted(deleted: Post) {
    focusComposerOnClose.current = true;
    setPosts((shown) => shown.filter((post) => post.id !== deleted.id));
    setOpen(null);
    toast.show("Post deleted.");
  }

  const prompt = viewer.role === "pet" ? `Share an update, ${viewer.name}…` : "Start a post…";

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Create a post" className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 md:p-5">
        <div className="flex items-center gap-3">
          <Avatar name={viewer.name} src={viewer.avatarUrl ?? undefined} alt="" />
          {/* Looks like the box it leads to; it is a button, since the writing happens in the dialog. */}
          <button
            ref={composer}
            type="button"
            onClick={() => setOpen({ kind: "post" })}
            className="min-h-11 min-w-0 flex-1 truncate rounded-pill border border-line-strong bg-surface px-4 text-left text-ink-muted transition-colors duration-200 ease-out hover:border-primary hover:bg-primary-soft hover:text-primary-soft-ink"
          >
            {prompt}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-1 gap-y-2">
          <Button variant="tertiary" size="sm" icon={<Icon name="image" className="size-4 shrink-0" />} onClick={() => setOpen({ kind: "post" })}>
            Photo
          </Button>
          {canTellStory && (
            <Button variant="tertiary" size="sm" icon={<Icon name="heart" className="size-4 shrink-0" />} onClick={() => setOpen({ kind: "story" })}>
              Write an adoption story
            </Button>
          )}
        </div>
      </section>

      {posts.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon="paw"
            title="No posts yet"
            description={viewer.role === "pet" ? "Updates from pets and posts from homes show up here. Yours can be the first." : "Posts from homes and updates from pets show up here. Yours can be the first."}
            action={
              <Button variant="primary" onClick={() => setOpen({ kind: "post" })}>
                {viewer.role === "pet" ? "Share an update" : "Start a post"}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <h2 className="sr-only">Posts</h2>
          {posts.map((post) => (
            <FeedPost
              key={post.id}
              post={post}
              when={formatTimeAgo(post.created_at, now)}
              viewerId={viewer.id}
              onPatch={(postId, patch) => setPosts((shown) => shown.map((other) => (other.id === postId ? { ...other, ...patch } : other)))}
              onEdit={(target) => setOpen({ kind: "edit", post: target })}
              onDelete={(target) => setOpen({ kind: "delete", post: target })}
              titleAs="h3"
            />
          ))}

          {loadProblem && (
            <Alert tone="error" announce>
              {loadProblem}
            </Alert>
          )}
          {page < lastPage ? (
            <Button className="self-center" loading={loading} loadingLabel="Loading more posts" onClick={() => void loadMore()}>
              {loadProblem ? "Try again" : "Show more posts"}
            </Button>
          ) : (
            <p className="py-2 text-center text-sm text-ink-muted">You’re all caught up.</p>
          )}
        </>
      )}

      <PostDialog
        open={open?.kind === "post" || open?.kind === "story" || open?.kind === "edit"}
        onClose={() => setOpen(null)}
        mode={open?.kind === "edit" ? "edit" : open?.kind === "story" ? "story" : "post"}
        viewer={viewer}
        pets={storyPets}
        post={open?.kind === "edit" ? open.post : undefined}
        onDone={(post) => (open?.kind === "edit" ? handleSaved(post) : handlePosted(post, open?.kind === "story" ? "Story posted." : "Posted."))}
      />

      <DeletePostDialog post={open?.kind === "delete" ? open.post : null} onClose={() => setOpen(null)} onDeleted={handleDeleted} />
    </div>
  );
}
