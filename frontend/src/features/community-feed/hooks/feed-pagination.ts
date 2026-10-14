import type { Post } from "@/types/post";

/**
 * How long a post the viewer just changed here (liked, edited, posted) keeps the copy on screen when a fresh first
 * batch arrives. The page is rendered again after every accepted write (src/lib/utils/page-refresher.ts), and a
 * render that started before this viewer's latest change would otherwise put the old count back for a moment.
 */
export const LOCAL_CHANGE_HOLD_MS = 5_000;

/** Keep edited/liked rows already on screen and append only unseen IDs in the server's order. */
export function appendFeedPosts(shown: Post[], incoming: Post[]): Post[] {
  const ids = new Set(shown.map((post) => post.id));
  return [...shown, ...incoming.filter((post) => {
    if (ids.has(post.id)) return false;
    ids.add(post.id);
    return true;
  })];
}

/** The feed's own order, as the API sorts it: newest first, then the higher id. Negative when `a` comes first. */
function feedOrder(a: Post, b: Post): number {
  return Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
}

/**
 * The page was rendered again, so a fresh first batch arrived: it is the truth for every post as new as its oldest
 * one. Those posts take the fresh copy (counts, edits), new ones appear, and ones the API no longer lists (deleted,
 * or their author suspended) go. Posts the viewer changed a moment ago (`isLocal`) keep the copy on screen, which
 * already carries the API's answer, and stay gone if they were deleted here. Older posts, loaded with "Show more
 * posts", stay as they are.
 */
export function mergeRefreshedFeed(shown: Post[], fresh: Post[], isLocal: (postId: number) => boolean): { posts: Post[]; olderLoaded: boolean } {
  const oldest = fresh.at(-1);
  if (!oldest) return { posts: shown.filter((post) => isLocal(post.id)), olderLoaded: false };

  const shownById = new Map(shown.map((post) => [post.id, post]));
  const freshIds = new Set(fresh.map((post) => post.id));
  const covered = (post: Post) => feedOrder(post, oldest) <= 0;

  const head = [
    // A post changed here that is no longer on screen was deleted here.
    ...fresh.flatMap((post) => {
      if (!isLocal(post.id)) return [post];
      const onScreen = shownById.get(post.id);
      return onScreen ? [onScreen] : [];
    }),
    ...shown.filter((post) => !freshIds.has(post.id) && covered(post) && isLocal(post.id)),
  ].sort(feedOrder);
  const older = shown.filter((post) => !freshIds.has(post.id) && !covered(post));

  return { posts: [...head, ...older], olderLoaded: older.length > 0 };
}
