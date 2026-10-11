"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useId, useState, useTransition } from "react";
import { Select } from "@/components/forms/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { optionsFrom } from "@/constants/pets";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { FilterDrawer } from "../dialogs/filter-drawer";
import {
  BROWSE_PARAMS,
  BROWSE_SEARCH_DELAY_MS,
  BROWSE_SORT_LABELS,
  type BrowseFilters,
  type BrowseKind,
  type BrowseSort,
  browseHref,
  browsePanelKey,
  clearPanelFilters,
  countPanelFilters,
  searchBoxAfter,
} from "../schemas/browse-filters";
import { BrowseSearchBox } from "./browse-search-box";
import { FilterFields } from "./filter-fields";

type Props = {
  kind: BrowseKind;
  /** The filters the results on the page were loaded with (from the URL). */
  filters: BrowseFilters;
  /** The results, rendered on the server. They dim while the next ones load. */
  children: ReactNode;
};

const SORT_OPTIONS = optionsFrom(BROWSE_SORT_LABELS).map(({ value, label }) => ({ value, label: `Sort: ${label}` }));

// The controls of Browse (DS-01, DS-02) around its results: the filter panel (a drawer below `lg`), the search box
// and the sort. Applying any of them only changes the URL; the page reads it on the server and loads the results,
// so every view can be linked and the back button undoes a filter. The search box applies itself: the names that
// match drop down under it at once (`BrowseSearchBox`), and the results follow the typing a moment after the last
// key, without Enter. The forms also work as plain GET forms before the page's JavaScript has loaded.
export function BrowseForm({ kind, filters, children }: Props) {
  const router = useRouter();
  const searchId = useId();
  const panelTitleId = useId();
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // What is picked in the panel and the sort. It follows the URL whenever that changes from outside them: a filter
  // chip removed, the back button.
  const panel = browsePanelKey(kind, filters);
  const [draft, setDraft] = useState(filters);
  const [shownPanel, setShownPanel] = useState(panel);
  if (shownPanel !== panel) {
    setShownPanel(panel);
    setDraft(filters);
  }

  // What is typed in the search box, and the searches it has asked for. The box follows the URL only when the
  // search there isn't one of its own (`searchBoxAfter`), so results that arrive late never undo a key just typed.
  const [search, setSearch] = useState(filters.search);
  const [asked, setAsked] = useState<readonly string[]>([filters.search]);
  const [shownSearch, setShownSearch] = useState(filters.search);
  if (shownSearch !== filters.search) {
    setShownSearch(filters.search);
    const box = searchBoxAfter(filters.search, asked);
    setAsked(box.asked);
    if (box.follow) setSearch(filters.search);
  }

  // Results as the user types: a moment after the last key, the applied filters are asked for again with the new
  // words, on page 1. The address is replaced, not added to, so the back button doesn't step through every letter,
  // and the page doesn't scroll away from the box. What is picked in the panel but not yet shown stays picked.
  const typed = search.trim();
  const liveHref = browseHref(kind, { ...filters, search: typed, page: 1 });
  const lastAsked = asked[asked.length - 1];
  useEffect(() => {
    if (typed === lastAsked) return;
    const timer = window.setTimeout(() => {
      setAsked((previous) => [...previous, typed]);
      startTransition(() => router.replace(liveHref, { scroll: false }));
    }, BROWSE_SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [typed, lastAsked, liveHref, router]);

  /** Shows the results for the panel, the sort and the search box as they are now, from page 1. */
  function apply(next: BrowseFilters) {
    const firstPage = { ...next, search: typed, page: 1 };
    setDraft(firstPage);
    setAsked((previous) => [...previous, typed]);
    startTransition(() => router.push(browseHref(kind, firstPage)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(draft);
  }

  const panelCount = countPanelFilters(filters);
  const noun = kind === "pets" ? "pets" : "homes";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      {/* Stays in view while the results scroll. It is never taller than the room under the page title, so
          "Show results" is on screen from the start; on a short screen the filters scroll inside the panel. */}
      <form
        action={ROUTES.browse}
        onSubmit={handleSubmit}
        aria-labelledby={panelTitleId}
        className="hidden max-h-[calc(100dvh-13.5rem)] flex-col overflow-hidden rounded-card border border-line bg-surface lg:sticky lg:top-[calc(var(--pf-topbar-h)+1.5rem)] lg:flex"
      >
        <div className="flex min-h-14 items-center justify-between gap-3 pt-2 pr-3 pl-5">
          <h2 id={panelTitleId} className="text-xl">
            Filters
          </h2>
          {countPanelFilters(draft) > 0 && (
            <Button variant="tertiary" size="sm" onClick={() => apply(clearPanelFilters(draft))}>
              Clear all
            </Button>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-1 pb-5">
          <FilterFields kind={kind} value={draft} onChange={setDraft} />
        </div>
        <div className="border-t border-line p-4">
          <Button type="submit" variant="primary" block loading={pending} loadingLabel="Loading results">
            Show results
          </Button>
        </div>
      </form>

      <div className="flex min-w-0 flex-col gap-4">
        {/* Named, since the top bar has a search of its own. */}
        <form role="search" aria-label={`Search ${noun}`} action={ROUTES.browse} onSubmit={handleSubmit} className="flex flex-wrap gap-3">
          <BrowseSearchBox id={searchId} kind={kind} filters={filters} value={search} onChange={setSearch} />

          <Button
            className="lg:hidden"
            icon={<Icon name="filter" className="size-4 shrink-0" />}
            onClick={() => setDrawerOpen(true)}
          >
            Filters
            {panelCount > 0 && (
              <span className="rounded-pill bg-primary px-1.5 text-xs leading-5 text-primary-ink tabular-nums">
                {panelCount}
                <span className="sr-only"> on</span>
              </span>
            )}
          </Button>

          <Select
            name={BROWSE_PARAMS.sort}
            aria-label={`Sort ${noun}`}
            value={draft.sort}
            onChange={(event) => apply({ ...draft, sort: event.target.value as BrowseSort })}
            options={SORT_OPTIONS}
            className="min-w-0 flex-1 md:w-52 md:flex-none"
          />
        </form>

        <div aria-busy={pending || undefined} className={cn("flex flex-col gap-4 transition-opacity duration-200 ease-out", pending && "opacity-60")}>
          {children}
        </div>
      </div>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDraft(filters);
        }}
        onApply={() => {
          setDrawerOpen(false);
          apply(draft);
        }}
        onClear={() => setDraft(clearPanelFilters(draft))}
        empty={countPanelFilters(draft) === 0}
      >
        <FilterFields kind={kind} value={draft} onChange={setDraft} />
      </FilterDrawer>
    </div>
  );
}
