import { describe, expect, it } from "vitest";
import { appendFeedPosts, mergeRefreshedFeed } from "@/features/community-feed/hooks/feed-pagination";
import type { Post } from "@/types/post";

const post = (id: number, body = "post") => ({ id, body, has_reacted: false } as Post);
// Newest first, as the API lists them: a higher id is a newer post.
const dated = (id: number, body = "post", reactions = 0) =>
  ({ id, body, has_reacted: false, reactions_count: reactions, created_at: new Date(Date.UTC(2026, 9, 14, 0, id)).toISOString() } as Post);
const ids = (posts: Post[]) => posts.map((item) => item.id);
const none = () => false;

describe("appending feed batches", () => {
  it("preserves edited and liked posts and server order while discarding duplicate IDs", () => {
    const liked = { ...post(5, "edited"), has_reacted: true };
    const result = appendFeedPosts([liked, post(4)], [post(4), post(3), post(3), post(2)]);
    expect(result.map((item) => item.id)).toEqual([5, 4, 3, 2]);
    expect(result[0]).toBe(liked);
  });

  it("does not mutate a cached batch or the list already on screen", () => {
    const shown = [post(2)];
    const batch = [post(2), post(1)];
    expect(appendFeedPosts(shown, batch)).toHaveLength(2);
    expect(shown).toHaveLength(1);
    expect(batch).toHaveLength(2);
  });
});

describe("taking in a fresh first batch after the page was rendered again", () => {
  it("replaces the posts it covers with the fresh copies and shows new ones", () => {
    const { posts, olderLoaded } = mergeRefreshedFeed([dated(5), dated(4)], [dated(6), dated(5, "post", 3), dated(4)], none);
    expect(ids(posts)).toEqual([6, 5, 4]);
    expect(posts[1].reactions_count).toBe(3);
    expect(olderLoaded).toBe(false);
  });

  it("drops covered posts the API no longer lists and keeps older loaded posts as they are", () => {
    const loadedBelow = dated(1, "loaded with Show more posts");
    const { posts, olderLoaded } = mergeRefreshedFeed([dated(5), dated(4), dated(3), loadedBelow], [dated(5), dated(3)], none);
    expect(ids(posts)).toEqual([5, 3, 1]);
    expect(posts[2]).toBe(loadedBelow);
    expect(olderLoaded).toBe(true);
  });

  it("keeps the copy on screen for a post just changed here", () => {
    const liked = { ...dated(5, "post", 1), has_reacted: true };
    const { posts } = mergeRefreshedFeed([liked, dated(4)], [dated(5, "post", 0), dated(4)], (id) => id === 5);
    expect(posts[0]).toBe(liked);
  });

  it("keeps a post just written here that the render missed, and doesn't bring back one just deleted here", () => {
    const written = dated(7, "just posted");
    const { posts } = mergeRefreshedFeed([written, dated(5)], [dated(6), dated(5), dated(4)], (id) => id === 7 || id === 6);
    expect(ids(posts)).toEqual([7, 5, 4]);
  });

  it("empties the list when the API lists nothing, except posts just written here", () => {
    expect(mergeRefreshedFeed([dated(2), dated(1)], [], none).posts).toEqual([]);
    expect(ids(mergeRefreshedFeed([dated(2), dated(1)], [], (id) => id === 2).posts)).toEqual([2]);
  });
});
