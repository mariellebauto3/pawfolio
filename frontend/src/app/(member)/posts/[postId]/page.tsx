import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ROUTES, postPath } from "@/constants/routes";
import { getFeed, getPost } from "@/features/community-feed/api/feed";
import { PostAside } from "@/features/community-feed/components/post-aside";
import { PostThread } from "@/features/community-feed/components/post-thread";
import { postIdFromUrl } from "@/features/community-feed/schemas/posts";
import type { FeedViewer, PostDetail } from "@/features/community-feed/types/feed";
import { isApiError } from "@/lib/api/errors";
import { getServerApi } from "@/lib/api/server";
import { homePathFor } from "@/lib/auth/redirects";
import { requireAccount } from "@/lib/auth/require-account";
import { formatTimeAgo } from "@/lib/utils/format-date";

export const metadata: Metadata = { title: "Post" };

type Props = {
  params: Promise<{ postId: string }>;
};

/** Other posts by the author, beside the one being read. */
const MORE_POSTS = 3;

// FD-05 Post detail & comments: one post in full with its comments and likes, the author beside it, and the post's
// own menu (FD-06) and delete dialog (FD-07). The id in the address is read as a number before anything is asked
// (SEC-FE-08), and a post that was deleted or removed is answered like one that never existed (SEC-AUTHZ-04).
export default async function PostPage({ params }: Props) {
  const id = postIdFromUrl((await params).postId);
  if (id === null) notFound();

  const account = await requireAccount(postPath(id));
  if (account.role === "admin") redirect(homePathFor(account));

  const api = await getServerApi();
  let detail: PostDetail;
  try {
    detail = await getPost(api, id);
  } catch (problem) {
    if (isApiError(problem) && problem.kind === "not_found") notFound();
    throw problem;
  }

  // An extra: the post shows even when the author's other posts can't be loaded.
  const others = await getFeed(api, { authorId: detail.author.id, perPage: MORE_POSTS + 1 })
    .then((page) => page.posts.filter((post) => post.id !== id).slice(0, MORE_POSTS))
    .catch(() => []);

  const now = new Date();
  const viewer: FeedViewer = { id: account.id, role: account.role, name: account.display_name, avatarUrl: account.avatar_url };

  return (
    <div className="flex flex-col gap-4">
      <Link href={ROUTES.memberHome} className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-primary hover:underline md:min-h-0">
        <Icon name="chevron-left" className="size-4 shrink-0" />
        Back to feed
      </Link>
      <h1 className="sr-only">Post by {detail.author.display_name}</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <PostThread detail={detail} viewer={viewer} renderedAt={now.toISOString()} />
        <PostAside post={detail} more={others.map((post) => ({ post, when: formatTimeAgo(post.created_at, now) }))} />
      </div>
    </div>
  );
}
