import type { IsoDateTime } from "@/types/api";
import type { PetSummary } from "@/types/pet";
import type { Role } from "@/types/statuses";

// A community feed post as the API sends it (docs/api/community-reports-and-admin.md, "Community Feed"). The type of
// a post is the system's: `for_hire` and `hired` are posted for a pet when its resume goes live and when it is
// adopted, `update` is a pet's own post and `post` a human's, by role. Nothing here is ever sent as it is (FR27).

export const POST_TYPES = ["for_hire", "hired", "update", "post", "adoption_story"] as const;
export type PostType = (typeof POST_TYPES)[number];

/** Who wrote a post or a comment: the name and photo, and the public line under the name (SEC-PRIV-03). */
export type PostAuthor = {
  /** The account's id. The viewer's own posts and comments are the ones whose author has their id. */
  id: number;
  role: Role;
  display_name: string;
  avatar_url: string | null;
  /** The pet's id or the Home Profile's id; null for an admin. */
  profile_id: number | null;
  /** A pet's breed; null for a human. */
  breed: string | null;
  city: string | null;
  /** The Furparent label of a human who adopted on Pawfolio (FR13). */
  is_furparent: boolean;
  /**
   * Whether the viewer may open the author's resume or Home Profile. False for a Draft resume and for a home whose
   * Open to Adopt is off: the name is then shown without a link.
   */
  is_profile_viewable: boolean;
};

export type PostPhoto = {
  id: number;
  url: string;
};

export type Post = {
  id: number;
  type: PostType;
  /** Adoption stories and the two automatic posts carry one; a pet's update or a human's post doesn't. */
  title: string | null;
  body: string;
  author: PostAuthor;
  /** The pet an adoption story or a Hired post is about. */
  adopted_pet: PetSummary | null;
  /** Up to 4, in the order they were added. */
  photos: PostPhoto[];
  reactions_count: number;
  /** The comments and replies the post's page lists. */
  comments_count: number;
  /** Whether the viewer liked it. */
  has_reacted: boolean;
  created_at: IsoDateTime;
};

/** A reply to a comment. Replies go one level deep: a reply can't be replied to (FD-05). */
export type PostReply = {
  id: number;
  post_id: number;
  parent_comment_id: number | null;
  body: string;
  author: PostAuthor;
  reactions_count: number;
  has_reacted: boolean;
  created_at: IsoDateTime;
};

/** A comment on a post with its replies, oldest first. */
export type PostComment = PostReply & {
  replies: PostReply[];
};
