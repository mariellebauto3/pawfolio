import { ADOPTIONS } from "@/lib/api/mock/fixtures/adoptions";
import { HOME_PROFILES } from "@/lib/api/mock/fixtures/home-profiles";
import { PETS } from "@/lib/api/mock/fixtures/pets";
import { type MockContext, type MockResult, type MockRoute, fail, ok, paginate, route, validationFailed } from "@/lib/api/mock/router";
import type { Account } from "@/types/account";
import type { PostType } from "@/types/post";

// The community feed in mock mode (docs/api/community-reports-and-admin.md, "Community Feed"): the LoFi's posts,
// written by the fixtures' pets and homes, with the same answers as the API. What is posted, liked, commented or
// deleted lives in memory, so it is back to these after a reload, and a page rendered on the server doesn't see what
// the browser changed. All of it is made up (SEC-PRIV-06).

type Author = { userId: number; role: "pet" | "human"; profileId: number };

// Whose account each fixture profile is. Mochi (1), Ana Santos (2) and Luna (9) are personas; the others only post.
const AUTHORS: Author[] = [
  { userId: 1, role: "pet", profileId: 1 },
  { userId: 2, role: "human", profileId: 1 },
  { userId: 9, role: "pet", profileId: 4 },
  { userId: 21, role: "pet", profileId: 5 },
  { userId: 22, role: "pet", profileId: 7 },
  { userId: 23, role: "human", profileId: 4 },
  { userId: 24, role: "human", profileId: 3 },
];

type PostRow = {
  id: number;
  author_user_id: number;
  type: PostType;
  title: string | null;
  body: string;
  adopted_pet_id: number | null;
  photos: { id: number; url: string; sort_order: number }[];
  created_at: string;
  deleted: boolean;
};

type CommentRow = {
  id: number;
  post_id: number;
  user_id: number;
  parent_comment_id: number | null;
  body: string;
  created_at: string;
  removed: boolean;
};

type ReactionRow = { user_id: number; post_id?: number; comment_id?: number };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const STARTED_AT = Date.now();
const ago = (ms: number) => new Date(STARTED_AT - ms).toISOString();
const placeholder = (id: number, name: string) => ({ id, url: `/images/placeholders/alumni/${name}.webp`, sort_order: 1 });

const POSTS: PostRow[] = [
  { id: 1, author_user_id: 21, type: "for_hire", title: "Pepper is Looking for a Home!", body: "I'm officially #LookingForAHome! Check out my resume to see if we're a match.", adopted_pet_id: null, photos: [placeholder(101, "choco-jr")], created_at: ago(HOUR_MS), deleted: false },
  { id: 2, author_user_id: 9, type: "hired", title: "Luna got Hired by Ana Santos!", body: "I officially have a forever home with Ana Santos in Quezon City! #GotHired #PawfolioAlumni", adopted_pet_id: 4, photos: [placeholder(102, "luna")], created_at: ago(3 * HOUR_MS), deleted: false },
  { id: 3, author_user_id: 23, type: "post", title: null, body: "Finally finished my Home Profile. Any tips for a first-time Furparent living in a condo?", adopted_pet_id: null, photos: [], created_at: ago(5 * HOUR_MS), deleted: false },
  { id: 4, author_user_id: 1, type: "update", title: null, body: "Had my first Meet & Greet today. I wore my best bandana.", adopted_pet_id: null, photos: [placeholder(103, "bantay"), placeholder(104, "mango")], created_at: ago(DAY_MS), deleted: false },
  {
    id: 5,
    author_user_id: 2,
    type: "adoption_story",
    title: "How Luna applied to our home",
    body: "It started with a cover letter about knocking things off tables.\n\nWe read it twice, laughed both times, and booked a Meet & Greet that same night. Two weeks later Luna was asleep on the couch like she had always lived here.",
    adopted_pet_id: 4,
    photos: [placeholder(105, "luna"), placeholder(106, "pancit"), placeholder(107, "brownie")],
    created_at: ago(2 * DAY_MS),
    deleted: false,
  },
  { id: 6, author_user_id: 22, type: "update", title: null, body: "Learned to wait at the gate without barking. My foster says I get extra chicken tonight.", adopted_pet_id: null, photos: [], created_at: ago(6 * DAY_MS), deleted: false },
];

const COMMENTS: CommentRow[] = [
  { id: 1, post_id: 2, user_id: 2, parent_comment_id: null, body: "She also reviews my work calls. Strict but fair.", created_at: ago(2 * HOUR_MS), removed: false },
  { id: 2, post_id: 2, user_id: 1, parent_comment_id: null, body: "Goals! Hoping to get Hired soon too.", created_at: ago(HOUR_MS), removed: false },
  { id: 3, post_id: 2, user_id: 9, parent_comment_id: 2, body: "You will. Wear the bandana.", created_at: ago(HOUR_MS / 2), removed: false },
  { id: 4, post_id: 4, user_id: 24, parent_comment_id: null, body: "Best bandana on Pawfolio. Good luck, Mochi!", created_at: ago(20 * HOUR_MS), removed: false },
  { id: 5, post_id: 5, user_id: 23, parent_comment_id: null, body: "This made my day. Congrats to you both.", created_at: ago(DAY_MS), removed: false },
];

const REACTIONS: ReactionRow[] = [
  { user_id: 2, post_id: 2 },
  { user_id: 23, post_id: 2 },
  { user_id: 24, post_id: 2 },
  { user_id: 1, post_id: 5 },
  { user_id: 23, post_id: 5 },
  { user_id: 2, post_id: 4 },
  { user_id: 9, comment_id: 2 },
];

const ANNOUNCEMENTS = [{ id: 1, title: "Pawfolio Adoption Week starts Oct 10!", message: "A week of adoption stories on the feed. Share yours.", audience: "everyone", published_at: ago(3 * DAY_MS) }];

let nextPostId = POSTS.length + 1;
let nextCommentId = COMMENTS.length + 1;
let nextPhotoId = 200;

/** The author block of a post or a comment, with the viewer's answer to "may I open this profile?". */
function authorBlock(userId: number, viewer: Account | null) {
  const author = AUTHORS.find((candidate) => candidate.userId === userId);
  if (!author) return null;
  if (author.role === "pet") {
    const pet = PETS.find((candidate) => candidate.id === author.profileId);
    if (!pet) return null;
    // A Draft resume opens for nobody but the pet.
    const viewable = pet.status !== "draft" || viewer?.id === userId;
    return { id: userId, role: "pet", display_name: pet.name, avatar_url: pet.photos[0]?.url ?? null, profile_id: pet.id, breed: pet.breed, city: pet.city, is_furparent: false, is_profile_viewable: viewable };
  }
  const home = HOME_PROFILES.find((candidate) => candidate.id === author.profileId);
  if (!home) return null;
  // A home whose Open to Adopt is off opens for nobody but its human.
  const viewable = home.is_open_to_adopt || viewer?.id === userId;
  return { id: userId, role: "human", display_name: home.full_name, avatar_url: home.profile_photo_url, profile_id: home.id, breed: null, city: home.city, is_furparent: home.is_furparent, is_profile_viewable: viewable };
}

function petSummary(petId: number | null) {
  const pet = PETS.find((candidate) => candidate.id === petId);
  return pet ? { id: pet.id, name: pet.name, species: pet.species, breed: pet.breed, city: pet.city, status: pet.status, photo_url: pet.photos[0]?.url ?? null } : null;
}

const visibleComments = (postId: number) => COMMENTS.filter((comment) => comment.post_id === postId && !comment.removed);

/** The comments a post's page lists: not a removed one, and not a reply whose comment was removed. */
function listedComments(postId: number) {
  const comments = visibleComments(postId);
  return comments.filter((comment) => comment.parent_comment_id === null || comments.some((parent) => parent.id === comment.parent_comment_id));
}

function postResource(post: PostRow, viewer: Account | null) {
  const reactions = REACTIONS.filter((reaction) => reaction.post_id === post.id);
  return {
    id: post.id,
    type: post.type,
    title: post.title,
    body: post.body,
    author: authorBlock(post.author_user_id, viewer),
    adopted_pet: petSummary(post.adopted_pet_id),
    photos: post.photos,
    reactions_count: reactions.length,
    comments_count: listedComments(post.id).length,
    has_reacted: reactions.some((reaction) => reaction.user_id === viewer?.id),
    created_at: post.created_at,
  };
}

function commentResource(comment: CommentRow, viewer: Account | null) {
  const reactions = REACTIONS.filter((reaction) => reaction.comment_id === comment.id);
  return {
    id: comment.id,
    post_id: comment.post_id,
    parent_comment_id: comment.parent_comment_id,
    body: comment.body,
    author: authorBlock(comment.user_id, viewer),
    reactions_count: reactions.length,
    has_reacted: reactions.some((reaction) => reaction.user_id === viewer?.id),
    created_at: comment.created_at,
  };
}

const findPost = (id: string) => POSTS.find((post) => String(post.id) === id && !post.deleted);
const findComment = (id: string) => COMMENTS.find((comment) => String(comment.id) === id && !comment.removed);

const NO_POST = () => fail(404, "We couldn't find that post.");

/** A field of a JSON body or of a form: the screens send a form when a post carries photos. */
function field(body: unknown, name: string): unknown {
  if (body instanceof FormData) return body.get(name);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>)[name] : undefined;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The photos of a form, as the API would store them. A mock has nowhere to keep a file, so each shows a placeholder. */
function storedPhotos(body: unknown): PostRow["photos"] | MockResult {
  const files = body instanceof FormData ? body.getAll("photos[]") : [];
  if (files.length > 4) return validationFailed({ photos: "The photos field must not have more than 4 items." });
  const names = ["bantay", "mango", "pancit", "brownie"];
  return files.map((_, index) => ({ ...placeholder(nextPhotoId++, names[index]), sort_order: index + 1 }));
}

const isRefusal = (value: PostRow["photos"] | MockResult): value is MockResult => !Array.isArray(value);

function toggleReaction(target: { post_id: number } | { comment_id: number }, { account }: MockContext): MockResult {
  const [key, id] = Object.entries(target)[0] as ["post_id" | "comment_id", number];
  const mine = REACTIONS.findIndex((reaction) => reaction[key] === id && reaction.user_id === account?.id);
  if (mine >= 0) REACTIONS.splice(mine, 1);
  else if (account) REACTIONS.push({ user_id: account.id, [key]: id });
  return ok({ reacted: mine < 0, reactions_count: REACTIONS.filter((reaction) => reaction[key] === id).length });
}

export const communityFeedRoutes: MockRoute[] = [
  route("GET", "/feed", ({ query, account }) => {
    let posts = POSTS.filter((post) => !post.deleted).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
    if (query.author_user_id !== undefined && query.author_user_id !== null) posts = posts.filter((post) => String(post.author_user_id) === String(query.author_user_id));
    if (typeof query.type === "string" && query.type !== "") {
      const types = query.type.split(",");
      posts = posts.filter((post) => types.includes(post.type));
    }
    const page = paginate(
      posts.map((post) => postResource(post, account)),
      query,
      "/api/v1/feed",
    );
    return { status: 200, body: { ...page, meta: { ...page.meta, announcements: ANNOUNCEMENTS } } };
  }),

  route("GET", "/posts/:postId", ({ params, account }) => {
    const post = findPost(params.postId);
    if (!post) return NO_POST();
    const comments = visibleComments(post.id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
    return ok({
      ...postResource(post, account),
      comments: comments
        .filter((comment) => comment.parent_comment_id === null)
        .map((comment) => ({
          ...commentResource(comment, account),
          replies: comments.filter((reply) => reply.parent_comment_id === comment.id).map((reply) => commentResource(reply, account)),
        })),
    });
  }),

  route("POST", "/posts", ({ body, account }) => {
    if (!account || account.role === "admin") return fail(403, "Only pets and humans post on the feed.");
    const words = text(field(body, "body"));
    if (words === "") return validationFailed({ body: "The body field is required." });
    if (words.length > 2000) return validationFailed({ body: "The body field must not be greater than 2000 characters." });
    const photos = storedPhotos(body);
    if (isRefusal(photos)) return photos;

    // The type is the server's to pick, from the role (FR27).
    const post: PostRow = { id: nextPostId++, author_user_id: account.id, type: account.role === "pet" ? "update" : "post", title: null, body: words, adopted_pet_id: null, photos, created_at: new Date().toISOString(), deleted: false };
    POSTS.push(post);
    return ok(postResource(post, account), 201);
  }),

  route("POST", "/posts/adoption-story", ({ body, account }) => {
    if (!account || account.role !== "human") return fail(403, "Only Furparents can publish an adoption story.");
    const petId = Number(field(body, "adopted_pet_id"));
    const title = text(field(body, "title"));
    const words = text(field(body, "body"));
    if (!Number.isInteger(petId) || petId < 1) return validationFailed({ adopted_pet_id: "The adopted pet id field is required." });
    if (title === "") return validationFailed({ title: "The title field is required." });
    if (title.length > 160) return validationFailed({ title: "The title field must not be greater than 160 characters." });
    if (words === "") return validationFailed({ body: "The body field is required." });
    if (words.length > 3000) return validationFailed({ body: "The body field must not be greater than 3000 characters." });
    // The adoption is checked, whatever the form offered (SEC-AUTHZ-02).
    if (!ADOPTIONS.some((adoption) => adoption.pet_id === petId && adoption.home_profile_id === account.profile_id)) {
      return fail(403, "You can only write an adoption story for a pet you adopted on Pawfolio.");
    }
    const photos = storedPhotos(body);
    if (isRefusal(photos)) return photos;

    const post: PostRow = { id: nextPostId++, author_user_id: account.id, type: "adoption_story", title, body: words, adopted_pet_id: petId, photos, created_at: new Date().toISOString(), deleted: false };
    POSTS.push(post);
    return ok(postResource(post, account), 201);
  }),

  route("PATCH", "/posts/:postId", ({ params, body, account }) => {
    const post = findPost(params.postId);
    if (!post) return NO_POST();
    if (post.author_user_id !== account?.id) return fail(403, "You can only edit your own active posts.");
    const words = text(field(body, "body"));
    if (words === "") return validationFailed({ body: "The body field is required." });
    if (words.length > 3000) return validationFailed({ body: "The body field must not be greater than 3000 characters." });
    const title = field(body, "title");
    if (title !== undefined) post.title = text(title) === "" ? null : text(title);
    post.body = words;
    return ok(postResource(post, account));
  }),

  route("DELETE", "/posts/:postId", ({ params, account }) => {
    const post = findPost(params.postId);
    if (!post) return NO_POST();
    if (post.author_user_id !== account?.id) return fail(403, "You can only delete your own posts.");
    post.deleted = true;
    return ok({ deleted: true });
  }),

  route("POST", "/posts/:postId/comments", ({ params, body, account }) => {
    const post = findPost(params.postId);
    if (!post || !account) return NO_POST();
    const words = text(field(body, "body"));
    if (words === "") return validationFailed({ body: "The body field is required." });
    if (words.length > 1000) return validationFailed({ body: "The body field must not be greater than 1000 characters." });

    const parentId = field(body, "parent_comment_id");
    let parent: CommentRow | undefined;
    if (parentId !== undefined && parentId !== null) {
      parent = visibleComments(post.id).find((comment) => comment.id === Number(parentId));
      if (!parent) return fail(404, "Parent comment not found.");
      if (parent.parent_comment_id !== null) return validationFailed({ parent_comment_id: "Replies can only be added to top-level comments." });
    }

    const comment: CommentRow = { id: nextCommentId++, post_id: post.id, user_id: account.id, parent_comment_id: parent?.id ?? null, body: words, created_at: new Date().toISOString(), removed: false };
    COMMENTS.push(comment);
    return ok(commentResource(comment, account), 201);
  }),

  route("DELETE", "/comments/:commentId", ({ params, account }) => {
    const comment = findComment(params.commentId);
    if (!comment) return fail(404, "Comment not found.");
    // Its author may, and so may the author of the post it is on.
    const post = POSTS.find((candidate) => candidate.id === comment.post_id);
    if (comment.user_id !== account?.id && post?.author_user_id !== account?.id) return fail(403, "You can only delete your own comments.");
    comment.removed = true;
    return ok({ deleted: true });
  }),

  route("POST", "/posts/:postId/reactions", (context) => {
    const post = findPost(context.params.postId);
    return post ? toggleReaction({ post_id: post.id }, context) : NO_POST();
  }),

  route("POST", "/comments/:commentId/reactions", (context) => {
    const comment = findComment(context.params.commentId);
    return comment ? toggleReaction({ comment_id: comment.id }, context) : fail(404, "Comment not found.");
  }),
];
