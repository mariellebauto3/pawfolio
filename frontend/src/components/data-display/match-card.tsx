import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** Where the card goes: the pet's resume or the Home Profile. */
  href: string;
  /** The pet's or the human's name. It is the card's one link. */
  title: string;
  /** A photo that runs to the card's edges, above everything else (pets). */
  media?: ReactNode;
  /** A round photo beside the name (homes). */
  avatar?: ReactNode;
  /** One line in the profile's own words, such as a home's headline. Clamped to two lines. */
  subtitle?: string | null;
  /** Short lines of facts: "Aspin · 2 years · Medium", then the place. */
  facts: string[];
  /** Status badges worth showing on a card: In Process, Furparent. */
  badges?: ReactNode;
  /** A few descriptive labels, e.g. the first temperament tags. */
  tags?: string[];
  /** The viewer's match, 0 to 100. Left out when there is no score to show. */
  score?: number;
  /** Why the score is what it is, in the API's words (MT-01, MT-02). A score is never shown alone on a ranked list. */
  reasons?: string[];
  /** What opening the card does: "View resume", "View home". */
  cta: string;
  /** More to do from the card, beside the link: Bookmark, "Why this match?", Remove. Pressing one doesn't open the card. */
  action?: ReactNode;
  /** Heading level for the name, so the card fits the page outline. */
  titleAs?: "h2" | "h3";
  className?: string;
};

// One pet or one home in a list (Browse DS-01/DS-02, matches MT-01/MT-02, and the bookmarks list after them). The
// whole card is one link, through the name: one stop for the keyboard and a large target for a thumb. An `action`
// sits on top of that link as a second stop. The match score is a yellow tab on the card's corner, the only yellow
// on it (HiFi rule 4), and always written out as "86% match". Names, headlines, tags and reasons come from users
// and the API and are rendered as plain text (SEC-FE-01).
export function MatchCard({
  href,
  title,
  media,
  avatar,
  subtitle,
  facts,
  badges,
  tags = [],
  score,
  reasons = [],
  cta,
  action,
  titleAs: Heading = "h3",
  className,
}: Props) {
  // Only a real number is a score: an answer without one shows no tab instead of "0% match".
  const hasScore = typeof score === "number" && Number.isFinite(score);
  const scoreTab = hasScore && (
    <p
      className={cn(
        "absolute right-0 flex items-baseline gap-1 border-accent-edge bg-accent px-2.5 py-1 text-accent-ink",
        media ? "bottom-0 rounded-tl-card border-t border-l" : "top-0 rounded-bl-card border-b border-l",
      )}
    >
      <span className="font-display text-xl leading-none font-bold tabular-nums">{Math.round(score)}%</span>
      <span className="text-xs font-bold">match</span>
    </p>
  );

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface",
        "transition-colors duration-200 ease-out hover:border-line-strong",
        className,
      )}
    >
      {media ? (
        <div className="relative">
          {media}
          {scoreTab}
        </div>
      ) : (
        scoreTab
      )}

      {/* Without a photo the score tab sits on the card's own corner, so the name starts below it. */}
      <div className={cn("flex flex-1 flex-col gap-3 p-4", !media && hasScore && "pt-11")}>
        <div className="flex items-start gap-3">
          {avatar}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Heading className="text-xl wrap-break-word">
              <Link href={href} data-card-link className="after:absolute after:inset-0 after:content-[''] hover:text-primary">
                {title}
              </Link>
            </Heading>
            {facts.map((line, index) => (
              <p key={index} className="text-sm text-ink-muted">
                {line}
              </p>
            ))}
          </div>
        </div>

        {subtitle && <p className="line-clamp-2 text-sm">{subtitle}</p>}

        {(badges || tags.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {badges}
            {tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        )}

        {reasons.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-sm">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 size-4 shrink-0 text-primary" />
                {reason}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 pt-1">
          {/* The link above already covers the card; this names what it does for people who look for a button. */}
          <p aria-hidden="true" className="text-sm font-bold text-primary group-has-[[data-card-link]:hover]:underline">
            {cta}
          </p>
          {/* Positioned, and after the link, so it is above the link's stretched hit area. */}
          {action && <div className="relative -mr-2 flex items-center">{action}</div>}
        </div>
      </div>
    </article>
  );
}
