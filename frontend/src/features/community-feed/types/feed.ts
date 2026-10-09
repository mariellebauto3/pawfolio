import type { IsoDateTime } from "@/types/api";
import type { Post, PostComment } from "@/types/post";

// What the feed endpoints answer and take (docs/api/community-reports-and-admin.md, "Community Feed"). The post
// itself is a shared type (`@/types/post`), since the post card is a shared component.

/** An admin's announcement, as the feed carries the latest few for the reader's role (NT-05). */
export type Announcement = {
  id: number;
  title: string;
  message: string;
  published_at: IsoDateTime | null;
};

/** `GET /feed`: one page of posts, newest first, and the announcements published for this account. */
export type FeedPage = {
  posts: Post[];
  /** 1-based, as the API counts pages. */
  page: number;
  lastPage: number;
  total: number;
  announcements: Announcement[];
};

/** `GET /posts/{id}`: the post with its comments, oldest first, each with its replies. */
export type PostDetail = Post & {
  comments: PostComment[];
};

/** What a like answers: where it stands now, and the new count. */
export type ReactionState = {
  has_reacted: boolean;
  reactions_count: number;
};

/** What the signed-in account is to the feed: whose posts are theirs, and how the composer greets them. */
export type FeedViewer = {
  /** The account's id. */
  id: number;
  role: "pet" | "human";
  name: string;
  avatarUrl: string | null;
};

/** A pet this Furparent adopted, as the adoption story form offers it (FD-04). */
export type StoryPet = {
  /** The pet's id, sent as `adopted_pet_id`. */
  id: number;
  name: string;
  adoptedAt: IsoDateTime | null;
};

export type NewPost = {
  body: string;
  /** JPG or PNG, up to 4. */
  photos: File[];
};

export type NewStory = NewPost & {
  petId: number;
  title: string;
};

export type PostEdit = {
  body: string;
  /** Only where the post has one to edit: an adoption story. Left out, the title stays as it is. */
  title?: string;
};
