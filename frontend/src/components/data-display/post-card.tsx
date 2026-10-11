import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { POST_TYPE_LABELS, POST_TYPE_TONES, authorLine, authorProfilePath } from "@/constants/posts";
import { petPath, postPath } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { formatDateTime } from "@/lib/utils/format-date";
import type { Post } from "@/types/post";
import { PostPhotos } from "./post-photos";

type Props = {
  post: Post;
  /** "2h ago". Worked out by whoever renders the list, so a page rendered on the server keeps the text it sent. */
  when: string;
  /** `feed`: a long post stops after a few lines and links to its page. `detail`: the post's own page (FD-05), in full. */
  variant?: "feed" | "detail";
  /** The ••• menu beside the badge (FD-06). */
  menu?: ReactNode;
  /** The row under the counts: Like, Comment, Share. */
  actions?: ReactNode;
  /** Below the actions, inside the card: the comments on the post's own page. */
  children?: ReactNode;
  /** Heading level for a post's title, so the card fits the page outline. */
  titleAs?: "h2" | "h3";
  className?: string;
};

/** A post this long, or with this many line breaks, is cut short on the feed. */
const LONG_POST_CHARS = 420;
const LONG_POST_LINES = 6;

const count = (total: number, one: string, many: string) => `${total} ${total === 1 ? one : many}`;

// One post on the community feed (FD-01, FD-02) and on its own page (FD-05): who posted and when, the type badge,
// the words, the photos, what the post is about (a resume that went live, an adopted pet), then the counts and the
// actions. Yellow marks the two posts that tell of an adoption and nothing else on the card. The title, the body
// and every name come from people and are rendered as text only: nothing in them becomes markup or a link
// (SEC-FE-01, SEC-FE-02).
export function PostCard({ post, when, variant = "feed", menu, actions, children, titleAs: Heading = "h2", className }: Props) {
  const { author } = post;
  const profilePath = authorProfilePath(author);
  const about = authorLine(author);
  const detail = variant === "detail";
  const long = !detail && (post.body.length > LONG_POST_CHARS || post.body.split("\n").length > LONG_POST_LINES);
  const href = postPath(post.id);
  const badge = <Badge tone={POST_TYPE_TONES[post.type]}>{POST_TYPE_LABELS[post.type]}</Badge>;

  return (
    <article className={cn("flex flex-col overflow-hidden rounded-card border border-line bg-surface", className)}>
      <header className="flex items-start gap-3 p-4 pb-0 md:p-5 md:pb-0">
        <Avatar name={author.display_name} src={author.avatar_url ?? undefined} alt="" />
        <div className="flex min-w-0 flex-1 flex-col">
          {profilePath ? (
            <Link href={profilePath} className="self-start font-bold text-ink no-underline wrap-break-word hover:text-primary hover:underline">
              {author.display_name}
            </Link>
          ) : (
            <span className="font-bold wrap-break-word">{author.display_name}</span>
          )}
          <p className="text-sm text-ink-muted">
            {about.map((part) => `${part} · `)}
            <time dateTime={post.created_at} title={formatDateTime(post.created_at)}>
              {when}
            </time>
          </p>
        </div>
        {/* Beside the name where there is room; on a phone it would squeeze the line under the name, so it leads the text instead. */}
        <div className="mt-0.5 hidden shrink-0 sm:block">{badge}</div>
        {menu && <div className="-mt-2 -mr-2 shrink-0">{menu}</div>}
      </header>

      <div className="flex flex-col gap-2 px-4 pt-3 pb-4 md:px-5">
        <div className="self-start sm:hidden">{badge}</div>
        {post.title && <Heading className="text-xl wrap-break-word">{post.title}</Heading>}
        {/* Line breaks are the author's; long words and pasted addresses wrap instead of widening the card. */}
        <p className={cn("wrap-break-word whitespace-pre-line", long && "line-clamp-6")}>{post.body}</p>
        {long && (
          <Link href={href} className="self-start text-sm font-bold text-primary hover:underline">
            Read the whole post
            <span className="sr-only"> by {author.display_name}</span>
          </Link>
        )}
      </div>

      <PostPhotos author={author.display_name} photos={post.photos} />

      {post.type === "for_hire" && (
        <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-card bg-surface-sunken px-4 py-3 md:mx-5">
          <p className="min-w-0 flex-1 basis-48 text-sm">Posted automatically when {author.display_name}’s resume went live.</p>
          {profilePath && (
            <Link href={profilePath} className={buttonClasses({ size: "sm" })}>
              View resume
              <span className="sr-only"> of {author.display_name}</span>
            </Link>
          )}
        </div>
      )}

      {post.type === "adoption_story" && post.adopted_pet && (
        <div className="mx-4 mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card bg-accent-soft px-4 py-3 text-accent-soft-ink md:mx-5">
          <Avatar name={post.adopted_pet.name} src={post.adopted_pet.photo_url ?? undefined} alt="" />
          <p className="min-w-0 flex-1 basis-40 text-sm">
            <span className="block font-bold wrap-break-word">{post.adopted_pet.name}’s adoption story</span>
            Adopted on Pawfolio
          </p>
          <Link href={petPath(post.adopted_pet.id)} className={buttonClasses({ size: "sm" })}>
            View alumni profile
            <span className="sr-only"> of {post.adopted_pet.name}</span>
          </Link>
        </div>
      )}

      <p className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 text-sm text-ink-muted md:px-5">
        <span>{count(post.reactions_count, "like", "likes")}</span>
        {detail ? (
          <span>{count(post.comments_count, "comment", "comments")}</span>
        ) : (
          <Link href={`${href}#comments`} className="text-ink-muted hover:text-primary hover:underline">
            {count(post.comments_count, "comment", "comments")}
            <span className="sr-only"> on {author.display_name}’s post</span>
          </Link>
        )}
      </p>

      {actions && <div className="flex border-t border-line px-2 py-1">{actions}</div>}

      {children && <div className="border-t border-line p-4 md:p-5">{children}</div>}
    </article>
  );
}
