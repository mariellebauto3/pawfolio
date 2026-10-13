import type { Post } from "@/types/post";

/** Keep edited/liked rows already on screen and append only unseen IDs in the server's order. */
export function appendFeedPosts(shown: Post[], incoming: Post[]): Post[] {
  const ids = new Set(shown.map((post) => post.id));
  return [...shown, ...incoming.filter((post) => {
    if (ids.has(post.id)) return false;
    ids.add(post.id);
    return true;
  })];
}
