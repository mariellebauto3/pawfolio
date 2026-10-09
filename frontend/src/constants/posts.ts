import type { BadgeTone } from "@/constants/status-badges";
import { homeProfilePath, petPath } from "@/constants/routes";
import type { PostAuthor, PostType } from "@/types/post";

// How a post is labelled on the feed (FD-01, FD-02). Shared by the post card and the screens around it.

export const POST_TYPE_LABELS = {
  for_hire: "For Hire",
  hired: "Hired",
  update: "Update",
  post: "Post",
  adoption_story: "Adoption story",
} as const satisfies Record<PostType, string>;

// Yellow is for the two posts that tell of an adoption (HiFi: yellow is good news); the rest keep the quiet outline.
export const POST_TYPE_TONES = {
  for_hire: "progress",
  hired: "celebrate",
  update: "progress",
  post: "progress",
  adoption_story: "celebrate",
} as const satisfies Record<PostType, BadgeTone>;

/** The line under an author's name: "Aspin, Pasig" for a pet, "Furparent, Quezon City" for a human. Parts the API didn't send are left out. */
export function authorLine(author: Pick<PostAuthor, "role" | "breed" | "city" | "is_furparent">): string[] {
  const lead = author.role === "pet" ? author.breed : author.is_furparent ? "Furparent" : null;
  return [lead, author.city].filter((part): part is string => typeof part === "string" && part.trim() !== "");
}

/** Where an author's name leads: the pet's resume or the human's Home Profile. Null when the viewer may not open it. */
export function authorProfilePath(author: Pick<PostAuthor, "role" | "profile_id" | "is_profile_viewable">): string | null {
  if (!author.is_profile_viewable || author.profile_id === null) return null;
  if (author.role === "pet") return petPath(author.profile_id);
  return author.role === "human" ? homeProfilePath(author.profile_id) : null;
}
