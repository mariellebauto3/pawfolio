import { describe, expect, it } from "vitest";
import { appendFeedPosts } from "@/features/community-feed/hooks/feed-pagination";
import type { Post } from "@/types/post";

const post = (id: number, body = "post") => ({ id, body, has_reacted: false } as Post);

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
