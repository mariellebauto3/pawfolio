import Link from "next/link";
import { HomeCard } from "@/components/data-display/home-card";
import { PetCard } from "@/components/data-display/pet-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import type { ReactNode } from "react";
import type { Paginated, PaginationMeta } from "@/types/api";
import { MATCH_PARAMS, type MatchView, matchSearchParams, matchesHref, pickedQuickFilter } from "../schemas/match-view";
import type { HomeMatch, PetMatch } from "../types/matching";
import { MatchBreakdownButton } from "./match-breakdown-button";

/** Bookmark on a card (BM-03). The Bookmarks module owns the button; the page passes it in for each row. */
type Bookmark = (profile: { id: number; name: string; saved: boolean }) => ReactNode;

type Props =
  | { kind: "pets"; view: MatchView; page: Paginated<PetMatch>; bookmark?: Bookmark }
  | { kind: "homes"; view: MatchView; page: Paginated<HomeMatch>; bookmark?: Bookmark };

/** The top reasons a card has room for (MT-01); the breakdown dialog lists them all. */
const CARD_REASONS = 2;

// Three cards across the content width on a desktop, two on a tablet, one on a phone.
const CARD_SIZES = "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw";

function summary({ total, from, to }: PaginationMeta): string {
  if (from !== null && to !== null && to - from + 1 < total) return `Showing ${from} to ${to} of ${total} matches`;
  return total === 1 ? "1 match" : `${total} matches`;
}

// The ranked list of Pets for You (MT-01) and Homes for You (MT-02). Every card carries its score with the top
// reasons and the way into the breakdown, never the number alone (ui-guidelines §6). Rendered on the server from the
// URL. The API has already left out every pair that fails a dealbreaker, and decides the order.
export function MatchResults({ kind, view, page, bookmark }: Props) {
  const filter = pickedQuickFilter(kind, view);
  const everything = kind === "pets" ? "pets" : "homes";

  if (page.meta.total === 0) {
    return filter ? (
      <EmptyState
        icon="search"
        title={`No ${filter.noun} among your matches`}
        description="This filter leaves nothing right now. Your other matches are still here."
        action={
          <Link href={matchesHref({ ...view, show: "", page: 1 })} className={buttonClasses({ variant: "primary" })}>
            Show all {everything}
          </Link>
        }
      />
    ) : kind === "pets" ? (
      <EmptyState
        icon="paw"
        title="No pets match your home yet"
        description="A pet shows up here once it passes your dealbreakers: a species you accept, in your province, and fine with the kids and pets at home. New resumes are checked as they are published."
        action={
          <Link href={ROUTES.browse} className={buttonClasses({ variant: "primary" })}>
            Browse all pets
          </Link>
        }
        secondaryAction={
          <Link href={ROUTES.homeProfileEdit} className={buttonClasses()}>
            Review your quiz answers
          </Link>
        }
      />
    ) : (
      <EmptyState
        icon="home"
        title="No homes match you yet"
        description="A home shows up here once it is Open to Adopt in your province, accepts your species, and suits who you’re good with. New homes are checked as they open."
        action={
          <Link href={ROUTES.browse} className={buttonClasses({ variant: "primary" })}>
            Browse all homes
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* Announced after a filter or the sort changes, since the list itself is replaced without a page load. */}
      <p role="status" className="text-sm text-ink-muted">
        {summary(page.meta)}
      </p>

      <h2 className="sr-only">Your matches</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kind === "pets"
          ? page.data.map(({ pet, score, reasons }) => (
              <li key={pet.id}>
                <PetCard
                  pet={pet}
                  score={score}
                  reasons={reasons.slice(0, CARD_REASONS)}
                  sizes={CARD_SIZES}
                  action={
                    <>
                      {bookmark?.({ id: pet.id, name: pet.name, saved: pet.is_bookmarked === true })}
                      <MatchBreakdownButton profileId={pet.id} name={pet.name} score={score} />
                    </>
                  }
                />
              </li>
            ))
          : page.data.map(({ home_profile: home, score, reasons }) => (
              <li key={home.id}>
                <HomeCard
                  home={home}
                  score={score}
                  reasons={reasons.slice(0, CARD_REASONS)}
                  action={
                    <>
                      {bookmark?.({ id: home.id, name: home.full_name, saved: home.is_bookmarked === true })}
                      <MatchBreakdownButton profileId={home.id} name={home.full_name} score={score} />
                    </>
                  }
                />
              </li>
            ))}
      </ul>

      <Pagination
        page={page.meta.current_page}
        totalPages={page.meta.last_page}
        searchParams={matchSearchParams(view)}
        param={MATCH_PARAMS.page}
        label={kind === "pets" ? "Pages of pets" : "Pages of homes"}
      />

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Icon name="info" className="mt-0.5 size-4 shrink-0" />
        Dealbreakers come first: a species the home doesn’t accept, kids or other pets that don’t suit, a different province. What’s left is
        sorted by score, then newest. Scores update when a quiz or a resume changes.
      </p>
    </>
  );
}
