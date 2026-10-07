"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useId, useState, useTransition } from "react";
import { CONTROL_CLASSES } from "@/components/forms/control-styles";
import { Select } from "@/components/forms/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { optionsFrom } from "@/constants/pets";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import { FilterDrawer } from "../dialogs/filter-drawer";
import {
  BROWSE_PARAMS,
  BROWSE_SEARCH_MAX,
  BROWSE_SORT_LABELS,
  type BrowseFilters,
  type BrowseKind,
  type BrowseSort,
  browseHref,
  clearPanelFilters,
  countPanelFilters,
} from "../schemas/browse-filters";
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
// so every view can be linked and the back button undoes a filter. The forms also work as plain GET forms before
// the page's JavaScript has loaded.
export function BrowseForm({ kind, filters, children }: Props) {
  const router = useRouter();
  const searchId = useId();
  const panelTitleId = useId();
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // What is picked in the controls. It follows the URL whenever that changes from outside them: a filter chip
  // removed, a page link, the back button.
  const applied = browseHref(kind, filters);
  const [draft, setDraft] = useState(filters);
  const [shown, setShown] = useState(applied);
  if (shown !== applied) {
    setShown(applied);
    setDraft(filters);
  }

  function apply(next: BrowseFilters) {
    const firstPage = { ...next, page: 1 };
    setDraft(firstPage);
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
          <div className="relative min-w-0 flex-1 basis-full md:basis-0">
            <label htmlFor={searchId} className="sr-only">
              Search {noun}
            </label>
            <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" />
            <input
              id={searchId}
              name={BROWSE_PARAMS.search}
              type="search"
              value={draft.search}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              placeholder={kind === "pets" ? "Search by name, breed or city" : "Search by name or city"}
              enterKeyHint="search"
              autoComplete="off"
              maxLength={BROWSE_SEARCH_MAX}
              className={cn(CONTROL_CLASSES, "pl-10")}
            />
          </div>

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
