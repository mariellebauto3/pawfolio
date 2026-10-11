import type { FieldErrors } from "@/lib/api/errors";
import type { Post, PostType } from "@/types/post";

// Client rules for the feed's forms (FD-03, FD-04, FD-05), mirroring `POST /posts`, `POST /posts/adoption-story`,
// `PATCH /posts/{id}` and `POST /posts/{id}/comments` (docs/api/community-reports-and-admin.md). They give fast
// feedback only: the API validates everything again and its answer wins (SEC-INPUT-01).

export const POST_BODY_MAX = 2000;
export const STORY_BODY_MAX = 3000;
export const POST_TITLE_MAX = 160;
export const COMMENT_BODY_MAX = 1000;
export const MAX_POST_PHOTOS = 4;

/** Posts on one page of the feed: the API's own default. */
export const FEED_PAGE_SIZE = 20;

/** What the post dialog is open for: a new post (FD-03), a new adoption story (FD-04), or the words of an existing post. */
export type PostFormMode = "post" | "story" | "edit";

export type PostFormValues = {
  title: string;
  body: string;
  /** The adopted pet's id as the select holds it; "" until one is picked. */
  petId: string;
};

/** The most a post's body may hold: a story has room for more. */
export function bodyMaxFor(type: PostType): number {
  return type === "adoption_story" ? STORY_BODY_MAX : POST_BODY_MAX;
}

/** Whether the form shows a title: a new story, or an edit of a post that is a story. */
export function hasTitleField(mode: PostFormMode, editing?: Pick<Post, "type">): boolean {
  return mode === "story" || (mode === "edit" && editing?.type === "adoption_story");
}

/**
 * What is wrong with the form, by the field names the API uses, so a 422 and these land in the same places. Empty
 * when it can be sent.
 */
export function validatePostForm(mode: PostFormMode, values: PostFormValues, editing?: Pick<Post, "type">): FieldErrors {
  const errors: FieldErrors = {};
  const story = mode === "story" || editing?.type === "adoption_story";
  const body = values.body.trim();
  const max = story ? STORY_BODY_MAX : POST_BODY_MAX;

  if (body === "") errors.body = story ? "Write your story first." : "Write something first.";
  else if (body.length > max) errors.body = `Keep it to ${max.toLocaleString("en-US")} characters or fewer.`;

  if (hasTitleField(mode, editing)) {
    const title = values.title.trim();
    if (title === "") errors.title = "Give your story a title.";
    else if (title.length > POST_TITLE_MAX) errors.title = `Keep the title to ${POST_TITLE_MAX} characters or fewer.`;
  }

  if (mode === "story" && !/^\d+$/.test(values.petId)) errors.adopted_pet_id = "Choose the pet this story is about.";

  return errors;
}

/** What is wrong with a comment or a reply; null when it can be sent. */
export function commentProblem(text: string): string | null {
  const body = text.trim();
  if (body === "") return "Write a comment first.";
  if (body.length > COMMENT_BODY_MAX) return `Keep it to ${COMMENT_BODY_MAX.toLocaleString("en-US")} characters or fewer.`;
  return null;
}

/**
 * The photo errors of a 422, in one message. The API names each file by its place (`photos.0`, `photos.2`); the
 * form has one photo field, so they are gathered there.
 */
export function photoError(errors: FieldErrors): string | null {
  const messages = Object.entries(errors)
    .filter(([field]) => field === "photos" || field.startsWith("photos."))
    .map(([, message]) => message);
  return messages.length > 0 ? [...new Set(messages)].join(" ") : null;
}

/** The post's id from its page's address (`/posts/12`); null for anything that isn't a whole number of 1 or more. */
export function postIdFromUrl(value: string): number | null {
  return /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}

/** "3 likes", "1 comment". */
export function countLabel(total: number, one: string, many: string): string {
  return `${total} ${total === 1 ? one : many}`;
}
