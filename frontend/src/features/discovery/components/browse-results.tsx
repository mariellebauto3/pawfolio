import Link from "next/link";
import { HomeCard } from "@/components/data-display/home-card";
import { PetCard } from "@/components/data-display/pet-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/navigation/pagination";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { ROUTES } from "@/constants/routes";
import type { Paginated, PaginationMeta } from "@/types/api";
import {
  BROWSE_PARAMS,
  type BrowseFilters,
  type BrowseKind,
  activeFilters,
  browseHref,
  browseSearchParams,
  clearPanelFilters,
} from "../schemas/browse-filters";
import type { HomeListing, PetListing } from "../types/discovery";

type Props =
  | { kind: "pets"; filters: BrowseFilters; results: Paginated<PetListing> }
  | { kind: "homes"; filters: BrowseFilters; results: Paginated<HomeListing> };

// Three cards across beside the filter panel on a wide screen, two on a laptop, one on a phone.
const CARD_SIZES = "(min-width: 1280px) 264px, (min-width: 1024px) 330px, (min-width: 640px) 50vw, 100vw";

function summary({ total, from, to }: PaginationMeta, kind: BrowseKind): string {
  const noun = kind === "pets" ? (total === 1 ? "pet" : "pets") : total === 1 ? "home" : "homes";
  if (from !== null && to !== null && to - from + 1 < total) return `Showing ${from} to ${to} of ${total} ${noun}`;
  return `${total} ${noun}`;
}

// The results side of Browse (DS-01, DS-02): what narrows them, the cards, the pages. Rendered on the server from
// the URL, so every view has its own address.
export function BrowseResults({ kind, filters, results }: Props) {
  const chips = activeFilters(kind, filters);
  const clearAll = browseHref(kind, { ...clearPanelFilters(filters), search: "" });

  if (results.meta.total === 0) {
    return chips.length > 0 ? (
      <EmptyState
        icon="search"
        title={kind === "pets" ? "No pets match these filters" : "No homes match these filters"}
        description="Take a filter off, or search for a broader word such as a city."
        action={
          <Link href={clearAll} className={buttonClasses({ variant: "primary" })}>
            Clear filters
          </Link>
        }
      />
    ) : (
      <EmptyState
        icon="paw"
        title={kind === "pets" ? "No pets are looking for a home right now" : "No homes are Open to Adopt right now"}
        description={
          kind === "pets"
            ? "New resumes show up here as soon as they are published."
            : "Homes show up here as soon as a human turns on Open to Adopt."
        }
        action={
          <Link href={ROUTES.memberHome} className={buttonClasses()}>
            Back to the feed
          </Link>
        }
      />
    );
  }

  return (
    <>
      {/* Announced after a filter changes, since the list itself is replaced without a page load. */}
      <p role="status" className="text-sm text-ink-muted">
        {summary(results.meta, kind)}
      </p>

      {chips.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          <li aria-hidden="true" className="text-sm text-ink-muted">
            Active filters:
          </li>
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link
                href={chip.href}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-line-strong bg-surface py-1 pr-2 pl-3 text-sm font-bold transition-colors duration-200 ease-out hover:border-primary hover:bg-primary-soft md:min-h-8"
              >
                <span className="sr-only">Remove filter: </span>
                {chip.label}
                <Icon name="x" className="size-4 shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
          {chips.length > 1 && (
            <li>
              <Link href={clearAll} className="px-1 text-sm font-bold text-primary underline hover:text-primary-hover">
                Clear all
              </Link>
            </li>
          )}
        </ul>
      )}

      <h2 className="sr-only">Results</h2>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kind === "pets"
          ? results.data.map((pet) => (
              <li key={pet.id}>
                <PetCard pet={pet} score={pet.match_score} sizes={CARD_SIZES} />
              </li>
            ))
          : results.data.map((home) => (
              <li key={home.id}>
                <HomeCard home={home} score={home.match_score} />
              </li>
            ))}
      </ul>

      <Pagination
        page={results.meta.current_page}
        totalPages={results.meta.last_page}
        searchParams={browseSearchParams(kind, filters)}
        param={BROWSE_PARAMS.page}
        label={kind === "pets" ? "Pages of pets" : "Pages of homes"}
      />

      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <Icon name={kind === "pets" ? "info" : "lock"} className="mt-0.5 size-4 shrink-0" />
        {kind === "pets"
          ? "Adopted pets never appear in Browse, search or matches."
          : "Home cards show public details only: the city and a household summary. No exact address or phone number."}
      </p>
    </>
  );
}
