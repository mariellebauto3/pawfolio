import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

export type Suggestion = {
  id: number;
  name: string;
  /** The city: all a card says about where someone lives (SEC-PRIV-03). */
  place: string;
  /** The pet's resume or the Home Profile. */
  href: string;
  photoUrl: string | null;
  /** The viewer's match with it, 0 to 100. */
  score: number;
};

type Props = {
  /** What the list holds: a human is matched with pets, a pet with homes. */
  kind: "pets" | "homes";
  /** The best few matches, best first. */
  suggestions: Suggestion[];
  /** Shown instead of the list when the account has no matches yet: what to do about it, and where. */
  notReady?: { message: string; action: string; href: string };
};

const SEE_ALL = "text-sm font-bold text-primary hover:underline";

// "Pets for You" or "Homes for You" beside the feed (FD-01, FD-02): the top of the ranked list, with the way to
// the rest. The feed itself is not ranked; this card is where the matches show up on it. A score is always written
// out as "86% match", never as a bare number.
export function FeedSuggestionsCard({ kind, suggestions, notReady }: Props) {
  const title = kind === "pets" ? "Pets for You" : "Homes for You";

  if (notReady) {
    return (
      <Card title={title} titleAs="h2">
        <p className="text-sm text-ink-muted">{notReady.message}</p>
        <Link href={notReady.href} className={`${SEE_ALL} self-start`}>
          {notReady.action}
        </Link>
      </Card>
    );
  }

  return (
    <Card
      title={title}
      titleAs="h2"
      action={
        <Link href={ROUTES.matches} className={SEE_ALL}>
          See all
          <span className="sr-only"> {title}</span>
        </Link>
      }
    >
      {suggestions.length === 0 ? (
        <p className="text-sm text-ink-muted">{kind === "pets" ? "No pets match your home right now. New resumes go live every day." : "No homes match you right now. New homes open up every day."}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="flex items-center gap-3">
              <Avatar name={suggestion.name} src={suggestion.photoUrl ?? undefined} alt="" />
              <p className="flex min-w-0 flex-1 flex-col">
                <Link href={suggestion.href} className="truncate font-bold text-ink no-underline hover:text-primary hover:underline">
                  {suggestion.name}
                </Link>
                <span className="truncate text-sm text-ink-muted">{suggestion.place}</span>
              </p>
              <p className="shrink-0 text-right leading-tight">
                <span className="font-display text-lg font-bold tabular-nums">{Math.round(suggestion.score)}%</span>
                <span className="block text-xs text-ink-muted">match</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
