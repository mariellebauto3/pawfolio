import { type ApiClient, apiPath } from "@/lib/api/core";
import { isApiError } from "@/lib/api/errors";
import { isRecord, isText, readPage, unexpected } from "@/lib/api/readers";
import type { ApiResource } from "@/types/api";
import type { PetSummary } from "@/types/pet";
import { POST_TYPES, type Post, type PostAuthor, type PostComment, type PostPhoto, type PostReply, type PostType } from "@/types/post";
import { ROLES, type Role } from "@/types/statuses";
import { FEED_PAGE_SIZE } from "../schemas/posts";
import type { Announcement, FeedPage, NewPost, NewStory, PostDetail, PostEdit, ReactionState } from "../types/feed";

// Community feed calls (docs/api/community-reports-and-admin.md, FD-01…FD-07, FR14, FR17, FR29). The two reads work
// from Server Components with `getServerApi()`; every write runs in the browser, where the CSRF token is. Who is
// posting comes from the session and a post's type from their role, so neither is ever sent (SEC-AUTHZ-02, FR27).
// The API decides who may edit or delete (SEC-FE-05), and every path with an id is built with apiPath (SEC-FE-08).

const FEED_PROBLEM = "We couldn't load the feed. Please try again.";
const POST_PROBLEM = "We couldn't load this post. Please try again.";
const SENT_PROBLEM = "We couldn't tell whether that was posted. Reload the page before posting it again.";
const SAVED_PROBLEM = "We couldn't confirm that was saved. Reload the page to see the post as it stands.";
const LIKE_PROBLEM = "We couldn't tell whether that was counted. Reload the page to see where it stands.";

const textOrNull = (value: unknown) => (isText(value) && value.trim() !== "" ? value : null);
const countOf = (value: unknown) => (typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0);
const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const isDate = (value: unknown): value is string => isText(value) && !Number.isNaN(new Date(value).getTime());

/**
 * Who wrote it, or null when the answer doesn't say. Whether the profile may be opened is read strictly: anything
 * but `true` leaves the name without a link, so a missing field never links to a profile the viewer may not see.
 */
function readAuthor(value: unknown): PostAuthor | null {
  if (!isRecord(value) || !isId(value.id) || !isText(value.display_name) || !(ROLES as readonly unknown[]).includes(value.role)) return null;
  return {
    id: value.id,
    role: value.role as Role,
    display_name: value.display_name,
    avatar_url: textOrNull(value.avatar_url),
    profile_id: isId(value.profile_id) ? value.profile_id : null,
    breed: textOrNull(value.breed),
    city: textOrNull(value.city),
    is_furparent: value.is_furparent === true,
    is_profile_viewable: value.is_profile_viewable === true,
  };
}

function readPhotos(value: unknown): PostPhoto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((photo) => (isRecord(photo) && isId(photo.id) && isText(photo.url) && photo.url !== "" ? [{ id: photo.id, url: photo.url }] : []));
}

function readAdoptedPet(value: unknown): PetSummary | null {
  if (!isRecord(value) || !isId(value.id) || !isText(value.name)) return null;
  return { ...(value as PetSummary), id: value.id, name: value.name, photo_url: textOrNull(value.photo_url) };
}

/**
 * A post as the screens read it, or null when it doesn't match the contract and isn't shown. The card picks its
 * badge from the type, so a type this screen doesn't know is read as a plain post.
 */
export function toPost(row: unknown): Post | null {
  if (!isRecord(row) || !isId(row.id) || !isText(row.body) || !isDate(row.created_at)) return null;
  const author = readAuthor(row.author);
  if (!author) return null;
  return {
    id: row.id,
    type: (POST_TYPES as readonly unknown[]).includes(row.type) ? (row.type as PostType) : "post",
    title: textOrNull(row.title),
    body: row.body,
    author,
    adopted_pet: readAdoptedPet(row.adopted_pet),
    photos: readPhotos(row.photos),
    reactions_count: countOf(row.reactions_count),
    comments_count: countOf(row.comments_count),
    has_reacted: row.has_reacted === true,
    created_at: row.created_at,
  };
}

function toReply(row: unknown): PostReply | null {
  if (!isRecord(row) || !isId(row.id) || !isId(row.post_id) || !isText(row.body) || !isDate(row.created_at)) return null;
  const author = readAuthor(row.author);
  if (!author) return null;
  return {
    id: row.id,
    post_id: row.post_id,
    parent_comment_id: isId(row.parent_comment_id) ? row.parent_comment_id : null,
    body: row.body,
    author,
    reactions_count: countOf(row.reactions_count),
    has_reacted: row.has_reacted === true,
    created_at: row.created_at,
  };
}

function toComment(row: unknown): PostComment | null {
  const comment = toReply(row);
  if (!comment || !isRecord(row)) return null;
  const replies = Array.isArray(row.replies) ? row.replies : [];
  return { ...comment, replies: replies.flatMap((reply) => toReply(reply) ?? []) };
}

function readAnnouncements(value: unknown): Announcement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) =>
    isRecord(row) && isId(row.id) && isText(row.title) && isText(row.message)
      ? [{ id: row.id, title: row.title, message: row.message, published_at: isDate(row.published_at) ? row.published_at : null }]
      : [],
  );
}

type FeedOptions = {
  page?: number;
  perPage?: number;
  /** Only this account's posts, for "More from…" on a post's page. */
  authorId?: number;
  signal?: AbortSignal;
};

/**
 * One page of the feed, newest first: For Hire posts, pet updates, human posts, Hired posts and adoption stories
 * together (FD-01, FD-02). Posts of accounts that aren't Active, removed posts and deleted posts are left out by
 * the API.
 */
export async function getFeed(client: ApiClient, { page = 1, perPage = FEED_PAGE_SIZE, authorId, signal }: FeedOptions = {}): Promise<FeedPage> {
  const query = { page: page > 1 ? page : undefined, per_page: perPage, author_user_id: authorId };
  const answered = readPage(await client.get<unknown>("/feed", { query, signal }), isRecord, FEED_PROBLEM);
  const meta: Record<string, unknown> = answered.meta;
  return {
    posts: answered.data.flatMap((row) => toPost(row) ?? []),
    page: answered.meta.current_page,
    lastPage: answered.meta.last_page,
    total: answered.meta.total,
    announcements: readAnnouncements(meta.announcements),
  };
}

/** One post with its comments (FD-05). 404 for a post that was deleted or removed, like one that never existed. */
export async function getPost(client: ApiClient, postId: number, signal?: AbortSignal): Promise<PostDetail> {
  const data = (await client.get<ApiResource<unknown>>(apiPath`/posts/${postId}`, { signal }))?.data;
  const post = toPost(data);
  if (!post || !isRecord(data)) throw unexpected(POST_PROBLEM);
  const comments = Array.isArray(data.comments) ? data.comments : [];
  return { ...post, comments: comments.flatMap((comment) => toComment(comment) ?? []) };
}

/** The words as JSON, or as a form when there are photos to carry. The API takes `photos[]`, each a JPG or a PNG. */
function postBody(fields: Record<string, string | number>, photos: File[]): Record<string, string | number> | FormData {
  if (photos.length === 0) return fields;
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, String(value));
  for (const photo of photos) form.append("photos[]", photo);
  return form;
}

function readSentPost(response: ApiResource<unknown> | null | undefined, problem: string): Post {
  const post = toPost(response?.data);
  if (!post) throw unexpected(problem);
  return post;
}

/**
 * Posts to the feed (FD-03): an Update from a pet, a Post from a human, as the API decides from the role. Throws
 * ApiError: 422 `fieldErrors` by field (`body`, `photos.0`…), 413 when the photos are more than the server takes.
 */
export async function createPost(client: ApiClient, { body, photos }: NewPost): Promise<Post> {
  return readSentPost(await client.post<ApiResource<unknown>>("/posts", postBody({ body: body.trim() }, photos)), SENT_PROBLEM);
}

/**
 * Posts an adoption story about a pet the Furparent adopted on Pawfolio (FD-04, FR14). 403 with a message to show
 * for anyone who isn't that pet's Furparent: the API checks the adoption itself, whatever the form offered.
 */
export async function createAdoptionStory(client: ApiClient, { petId, title, body, photos }: NewStory): Promise<Post> {
  const fields = { adopted_pet_id: petId, title: title.trim(), body: body.trim() };
  return readSentPost(await client.post<ApiResource<unknown>>("/posts/adoption-story", postBody(fields, photos)), SENT_PROBLEM);
}

/** Changes the words of the author's own post (FD-06). Photos stay as they are. 403 for anyone but the author. */
export async function updatePost(client: ApiClient, postId: number, { body, title }: PostEdit): Promise<Post> {
  const fields = title === undefined ? { body: body.trim() } : { body: body.trim(), title: title.trim() };
  return readSentPost(await client.patch<ApiResource<unknown>>(apiPath`/posts/${postId}`, fields), SAVED_PROBLEM);
}

/** True when the thing to remove was already gone: the outcome the caller asked for either way. */
const alreadyGone = (problem: unknown) => isApiError(problem) && problem.kind === "not_found";

/** Deletes the author's own post (FD-07). Deleting one that is already gone is not an error. 403 for anyone else. */
export async function deletePost(client: ApiClient, postId: number): Promise<void> {
  try {
    await client.delete<unknown>(apiPath`/posts/${postId}`);
  } catch (problem) {
    if (!alreadyGone(problem)) throw problem;
  }
}

/**
 * Adds a comment to a post, or a reply when `parentId` names one of its comments (FD-05). Replies go one level
 * deep: 422 for a reply to a reply. 404 when the post, or the comment replied to, is gone.
 */
export async function addComment(client: ApiClient, postId: number, body: string, parentId?: number): Promise<PostComment> {
  const fields = parentId === undefined ? { body: body.trim() } : { body: body.trim(), parent_comment_id: parentId };
  const comment = toReply((await client.post<ApiResource<unknown>>(apiPath`/posts/${postId}/comments`, fields))?.data);
  if (!comment) throw unexpected(SENT_PROBLEM);
  return { ...comment, replies: [] };
}

/** Removes a comment: its author may, and so may the author of the post it is on. One that is already gone is not an error. */
export async function deleteComment(client: ApiClient, commentId: number): Promise<void> {
  try {
    await client.delete<unknown>(apiPath`/comments/${commentId}`);
  } catch (problem) {
    if (!alreadyGone(problem)) throw problem;
  }
}

function readReaction(response: ApiResource<unknown> | null | undefined): ReactionState {
  const data = response?.data;
  if (!isRecord(data) || typeof data.reacted !== "boolean" || typeof data.reactions_count !== "number") throw unexpected(LIKE_PROBLEM);
  return { has_reacted: data.reacted, reactions_count: countOf(data.reactions_count) };
}

/** Likes a post, or takes the like back: one call toggles. Answers where it stands now. */
export async function togglePostReaction(client: ApiClient, postId: number): Promise<ReactionState> {
  return readReaction(await client.post<ApiResource<unknown>>(apiPath`/posts/${postId}/reactions`));
}

/** The same for a comment or a reply. */
export async function toggleCommentReaction(client: ApiClient, commentId: number): Promise<ReactionState> {
  return readReaction(await client.post<ApiResource<unknown>>(apiPath`/comments/${commentId}/reactions`));
}
