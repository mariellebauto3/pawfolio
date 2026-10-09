import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { buttonClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { authorLine, authorProfilePath } from "@/constants/posts";
import { postPath } from "@/constants/routes";
import type { Post } from "@/types/post";

type Props = {
  post: Pick<Post, "author">;
  /** Other posts by the same account, newest first, each with its "2h ago". Empty leaves the card out. */
  more: { post: Post; when: string }[];
};

// Beside a post on its own page (FD-05): who wrote it, with the way to their resume or Home Profile when the viewer
// may open it, and a few more of their posts. Everything here is the author's public line and their own words,
// rendered as text (SEC-PRIV-03, SEC-FE-01).
export function PostAside({ post, more }: Props) {
  const { author } = post;
  const profilePath = authorProfilePath(author);
  const about = authorLine({ ...author, is_furparent: false });

  return (
    <aside aria-label="About this post" className="flex flex-col gap-4">
      <Card title="About the author" titleAs="h2">
        <div className="flex items-center gap-3">
          <Avatar name={author.display_name} src={author.avatar_url ?? undefined} alt="" size="lg" />
          <div className="flex min-w-0 flex-col items-start gap-1">
            <p className="font-bold wrap-break-word">{author.display_name}</p>
            {about.length > 0 && <p className="text-sm text-ink-muted">{about.join(" · ")}</p>}
            {author.is_furparent && <StatusBadge status="Furparent" />}
          </div>
        </div>
        {profilePath && (
          <Link href={profilePath} className={buttonClasses({ size: "sm", className: "self-start" })}>
            {author.role === "pet" ? "View resume" : "View Home Profile"}
            <span className="sr-only"> of {author.display_name}</span>
          </Link>
        )}
      </Card>

      {more.length > 0 && (
        <Card title={`More from ${author.display_name}`} titleAs="h2">
          <ul className="flex flex-col divide-y divide-line">
            {more.map(({ post: other, when }) => (
              <li key={other.id} className="py-3 first:pt-0 last:pb-0">
                <Link href={postPath(other.id)} className="group flex flex-col gap-0.5 text-ink no-underline">
                  <span className="line-clamp-2 text-sm wrap-break-word group-hover:text-primary group-hover:underline">{other.title ?? other.body}</span>
                  <time dateTime={other.created_at} className="text-xs text-ink-muted">
                    {when}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </aside>
  );
}
