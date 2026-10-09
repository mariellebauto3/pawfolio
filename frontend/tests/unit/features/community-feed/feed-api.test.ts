import { describe, expect, it } from "vitest";
import { authorLine, authorProfilePath } from "@/constants/posts";
import {
  addComment,
  createAdoptionStory,
  createPost,
  deleteComment,
  deletePost,
  getFeed,
  getPost,
  toPost,
  toggleCommentReaction,
  togglePostReaction,
  updatePost,
} from "@/features/community-feed/api/feed";
import { type Transport, createApiClient } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { MOCK_PERSONA_COOKIE, createMockTransport } from "@/lib/api/mock/transport";

// The feed calls against the mock API, which answers in the shapes of docs/api/community-reports-and-admin.md. The
// mock keeps what is posted in memory for the whole file, so the tests that change it come last.
function as(persona: string) {
  return createApiClient(createMockTransport({ readCookie: (name) => (name === MOCK_PERSONA_COOKIE ? persona : null), writePersona: () => {}, latencyMs: 0 }));
}

/** A client whose API answers every call with `body` and `status`, and remembers what it was asked. */
function answering(body: unknown, status = 200) {
  const calls: { method: string; path: string; body?: unknown; query?: unknown }[] = [];
  const transport: Transport = async ({ method, path, body: sent, query }) => {
    calls.push({ method, path, body: sent, query });
    return { status, body, retryAfter: null };
  };
  return { client: createApiClient(transport), calls };
}

const AUTHOR = { id: 7, role: "pet", display_name: "Mochi", avatar_url: null, profile_id: 3, breed: "Aspin", city: "Pasig", is_furparent: false, is_profile_viewable: true };
const POST = { id: 12, type: "update", title: null, body: "Hello", author: AUTHOR, adopted_pet: null, photos: [], reactions_count: 2, comments_count: 1, has_reacted: true, created_at: "2026-10-09T02:00:00.000000Z" };
const META = { total: 1, current_page: 1, last_page: 1 };

const failure = async (run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (problem) {
    if (isApiError(problem)) return problem;
    throw problem;
  }
  throw new Error("Expected the call to fail.");
};

describe("the feed (FD-01, FD-02)", () => {
  it("lists everyone's posts together, newest first, with the announcements for the reader", async () => {
    const feed = await getFeed(as("pet"));
    expect(feed.posts.map((post) => post.type)).toEqual(["for_hire", "hired", "post", "update", "adoption_story", "update"]);
    expect(feed).toMatchObject({ page: 1, lastPage: 1, total: 6 });
    expect(feed.announcements[0]).toMatchObject({ title: "Pawfolio Adoption Week starts Oct 10!" });
  });

  it("names each author with their public line, and says whether their profile opens", async () => {
    const feed = await getFeed(as("pet"));
    const [forHire, , byHuman, own, story] = feed.posts;
    expect(forHire.author).toMatchObject({ role: "pet", display_name: "Pepper", breed: "Aspin", city: "Marikina", is_profile_viewable: true });
    expect(byHuman.author).toMatchObject({ role: "human", display_name: "Marco Reyes", breed: null, city: "Mandaluyong", is_furparent: false });
    expect(own.author.id).toBe(1);
    expect(story).toMatchObject({ title: "How Luna applied to our home", adopted_pet: { id: 4, name: "Luna" }, author: { display_name: "Ana Santos", is_furparent: true } });
    expect(story.photos).toHaveLength(3);
  });

  it("tells each reader which posts they liked", async () => {
    const liked = async (persona: string) => (await getFeed(as(persona))).posts.filter((post) => post.has_reacted).map((post) => post.id);
    expect(await liked("pet")).toEqual([5]);
    expect(await liked("human")).toEqual([2, 4]);
  });

  it("asks for one author's posts, a page at a time", async () => {
    const { client, calls } = answering({ data: [], meta: META, links: {} });
    await getFeed(client, { authorId: 9, perPage: 4 });
    await getFeed(client, { page: 3 });
    expect(calls.map((call) => call.query)).toEqual([
      { page: undefined, per_page: 4, author_user_id: 9 },
      { page: 3, per_page: 20, author_user_id: undefined },
    ]);
    expect((await getFeed(as("pet"), { authorId: 2 })).posts.map((post) => post.id)).toEqual([5]);
  });

  it("refuses an answer that isn't a page, and leaves out a row that isn't a post", async () => {
    expect((await failure(() => getFeed(answering({ data: "nope" }).client))).message).toBe("We couldn't load the feed. Please try again.");
    const rows = [POST, { ...POST, id: 13, author: null }, { ...POST, id: 14, body: 5 }, { ...POST, id: 15, created_at: "soon" }, "post"];
    expect((await getFeed(answering({ data: rows, meta: META, links: {} }).client)).posts.map((post) => post.id)).toEqual([12]);
  });

  it("is closed to accounts that aren't signed in or aren't Active", async () => {
    expect((await failure(() => getFeed(as("signed-out")))).kind).toBe("unauthenticated");
    expect((await failure(() => getFeed(as("pet-pending")))).kind).toBe("account_not_active");
    expect((await failure(() => createPost(as("pet-suspended"), { body: "Hello", photos: [] }))).kind).toBe("account_not_active");
  });
});

describe("reading a post (toPost)", () => {
  it("reads what the screens use and nothing else", () => {
    expect(toPost({ ...POST, secret: "x", author: { ...AUTHOR, email: "mochi@example.com" } })).toEqual(POST);
  });

  it("links a name only when the API says the profile opens", () => {
    const without = toPost({ ...POST, author: { ...AUTHOR, is_profile_viewable: undefined } });
    expect(without?.author.is_profile_viewable).toBe(false);
    expect(authorProfilePath(without!.author)).toBeNull();
    expect(authorProfilePath(AUTHOR as never)).toBe("/pets/3");
    expect(authorProfilePath({ role: "human", profile_id: 2, is_profile_viewable: true })).toBe("/homes/2");
    expect(authorProfilePath({ role: "admin", profile_id: null, is_profile_viewable: true })).toBeNull();
  });

  it("reads a type it doesn't know as a plain post, and odd counts as none", () => {
    expect(toPost({ ...POST, type: "poll", reactions_count: -3, comments_count: "9", has_reacted: "yes" })).toMatchObject({ type: "post", reactions_count: 0, comments_count: 0, has_reacted: false });
  });

  it("keeps only photos and an adopted pet that match the contract", () => {
    const post = toPost({ ...POST, photos: [{ id: 1, url: "/a.jpg", sort_order: 1 }, { id: 2 }, { url: "/b.jpg" }, null], adopted_pet: { name: "Luna" } });
    expect(post).toMatchObject({ photos: [{ id: 1, url: "/a.jpg" }], adopted_pet: null });
  });

  it("writes the line under a name from what is public", () => {
    expect(authorLine({ role: "pet", breed: "Aspin", city: "Pasig", is_furparent: false })).toEqual(["Aspin", "Pasig"]);
    expect(authorLine({ role: "human", breed: null, city: "Quezon City", is_furparent: true })).toEqual(["Furparent", "Quezon City"]);
    expect(authorLine({ role: "human", breed: null, city: null, is_furparent: false })).toEqual([]);
  });
});

describe("a post's page (FD-05)", () => {
  it("gives the post with its comments, oldest first, each with its replies", async () => {
    const post = await getPost(as("pet"), 2);
    expect(post).toMatchObject({ id: 2, type: "hired", comments_count: 3, reactions_count: 3 });
    expect(post.comments.map((comment) => comment.author.display_name)).toEqual(["Ana Santos", "Mochi"]);
    expect(post.comments[1].replies.map((reply) => reply.body)).toEqual(["You will. Wear the bandana."]);
    expect(post.comments[1]).toMatchObject({ reactions_count: 1, has_reacted: false, parent_comment_id: null });
  });

  it("answers a post that isn't there like any other missing page", async () => {
    expect((await failure(() => getPost(as("pet"), 999))).kind).toBe("not_found");
    expect((await failure(() => getPost(answering({ data: { id: 1 } }).client, 1))).message).toBe("We couldn't load this post. Please try again.");
  });

  it("builds every path from the id it was given", async () => {
    const { client, calls } = answering({ data: { reacted: true, reactions_count: 1 } });
    await togglePostReaction(client, 12);
    await toggleCommentReaction(client, 34);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual(["POST /posts/12/reactions", "POST /comments/34/reactions"]);
  });
});

describe("what a post is sent as (FD-03, FD-04)", () => {
  it("sends the words alone as JSON, and never a type or an author", async () => {
    const { client, calls } = answering({ data: POST });
    await createPost(client, { body: "  Hello  ", photos: [] });
    expect(calls[0]).toMatchObject({ method: "POST", path: "/posts", body: { body: "Hello" } });
  });

  it("sends photos as a form, each under photos[]", async () => {
    const { client, calls } = answering({ data: POST });
    const photos = [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.png", { type: "image/png" })];
    await createAdoptionStory(client, { petId: 4, title: " Our story ", body: "Words", photos });
    const form = calls[0].body as FormData;
    expect(calls[0].path).toBe("/posts/adoption-story");
    expect(form).toBeInstanceOf(FormData);
    expect([form.get("adopted_pet_id"), form.get("title"), form.get("body")]).toEqual(["4", "Our story", "Words"]);
    expect(form.getAll("photos[]").map((file) => (file as File).name)).toEqual(["a.jpg", "b.png"]);
  });

  it("leaves the title alone on an edit unless there is one to save", async () => {
    const { client, calls } = answering({ data: POST });
    await updatePost(client, 12, { body: "New words" });
    await updatePost(client, 12, { body: "New words", title: "New title" });
    expect(calls.map((call) => call.body)).toEqual([{ body: "New words" }, { body: "New words", title: "New title" }]);
    expect(calls[0]).toMatchObject({ method: "PATCH", path: "/posts/12" });
  });

  it("doesn't call something posted until the API answers with it", async () => {
    expect((await failure(() => createPost(answering({ data: null }).client, { body: "Hello", photos: [] }))).message).toContain("Reload the page before posting it again");
  });

  it("counts a post or a comment that is already gone as deleted", async () => {
    const gone = answering({ message: "Not found." }, 404).client;
    await expect(deletePost(gone, 12)).resolves.toBeUndefined();
    await expect(deleteComment(gone, 34)).resolves.toBeUndefined();
    expect((await failure(() => deletePost(answering({ message: "You can only delete your own posts." }, 403).client, 12))).message).toBe("You can only delete your own posts.");
  });
});

// From here on the tests change what the mock holds.
describe("posting, liking, commenting and deleting", () => {
  it("posts an Update for a pet and a Post for a human, at the top of the feed", async () => {
    const update = await createPost(as("pet"), { body: "I learned to shake hands.", photos: [] });
    expect(update).toMatchObject({ type: "update", body: "I learned to shake hands.", author: { display_name: "Mochi" }, reactions_count: 0, comments_count: 0, has_reacted: false });
    expect((await createPost(as("human"), { body: "Our gate is finally cat-proof.", photos: [] })).type).toBe("post");
    expect((await getFeed(as("pet"))).posts.slice(0, 2).map((post) => post.body)).toEqual(["Our gate is finally cat-proof.", "I learned to shake hands."]);
  });

  it("returns the API's field errors for an empty post", async () => {
    const problem = await failure(() => createPost(as("pet"), { body: "   ", photos: [] }));
    expect(problem.kind).toBe("validation");
    expect(problem.fieldErrors.body).toBeTruthy();
  });

  it("lets only a Furparent tell the story of a pet they adopted", async () => {
    const story = { petId: 4, title: "Luna, one month in", body: "She owns the couch now.", photos: [] };
    expect((await failure(() => createAdoptionStory(as("pet"), story))).kind).toBe("forbidden");
    expect((await failure(() => createAdoptionStory(as("human"), { ...story, petId: 1 }))).message).toBe("You can only write an adoption story for a pet you adopted on Pawfolio.");
    expect(await createAdoptionStory(as("human"), story)).toMatchObject({ type: "adoption_story", title: "Luna, one month in", adopted_pet: { name: "Luna" } });
  });

  it("toggles a like and answers where it stands", async () => {
    expect(await togglePostReaction(as("pet"), 3)).toEqual({ has_reacted: true, reactions_count: 1 });
    expect((await getPost(as("pet"), 3)).has_reacted).toBe(true);
    expect((await getPost(as("human"), 3)).has_reacted).toBe(false);
    expect(await togglePostReaction(as("pet"), 3)).toEqual({ has_reacted: false, reactions_count: 0 });
    expect(await toggleCommentReaction(as("pet"), 1)).toEqual({ has_reacted: true, reactions_count: 1 });
  });

  it("adds a comment and a reply, one level deep", async () => {
    const comment = await addComment(as("human"), 3, "  Start with a tall scratching post.  ");
    expect(comment).toMatchObject({ post_id: 3, parent_comment_id: null, body: "Start with a tall scratching post.", author: { display_name: "Ana Santos" }, replies: [] });
    const reply = await addComment(as("pet"), 3, "And treats.", comment.id);
    expect(reply.parent_comment_id).toBe(comment.id);
    expect((await failure(() => addComment(as("human"), 3, "Too deep", reply.id))).fieldErrors.parent_comment_id).toBe("Replies can only be added to top-level comments.");
    expect((await getPost(as("pet"), 3)).comments_count).toBe(2);
  });

  it("lets the comment's author or the post's author remove a comment, and its replies leave with it", async () => {
    const post = await createPost(as("pet"), { body: "Ask me anything.", photos: [] });
    const comment = await addComment(as("human"), post.id, "Favourite snack?");
    await addComment(as("pet"), post.id, "Chicken.", comment.id);
    expect((await failure(() => deleteComment(as("pet-hired"), comment.id))).kind).toBe("forbidden");

    // Mochi wrote the post, so Mochi may remove Ana's comment on it.
    await deleteComment(as("pet"), comment.id);
    expect(await getPost(as("pet"), post.id)).toMatchObject({ comments_count: 0, comments: [] });
  });

  it("lets only the author edit or delete a post", async () => {
    expect((await failure(() => updatePost(as("human"), 4, { body: "Not mine" }))).kind).toBe("forbidden");
    expect((await failure(() => deletePost(as("human"), 4))).kind).toBe("forbidden");

    expect(await updatePost(as("pet"), 4, { body: "Had my first Meet & Greet today. It went well." })).toMatchObject({ id: 4, body: "Had my first Meet & Greet today. It went well.", title: null });
    await deletePost(as("pet"), 4);
    expect((await failure(() => getPost(as("pet"), 4))).kind).toBe("not_found");
    expect((await getFeed(as("pet"))).posts.some((post) => post.id === 4)).toBe(false);
  });
});
