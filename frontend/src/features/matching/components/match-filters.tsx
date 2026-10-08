"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Select } from "@/components/forms/select";
import { Icon } from "@/components/ui/icon";
import { optionsFrom } from "@/constants/pets";
import { cn } from "@/lib/utils/cn";
import { MATCH_SORT_LABELS, type MatchKind, type MatchSort, type MatchView, matchesHref, quickFiltersFor } from "../schemas/match-view";

type Props = {
  kind: MatchKind;
  /** The view the matches on the page were loaded with (from the URL). */
  view: MatchView;
};

const SORT_OPTIONS = optionsFrom(MATCH_SORT_LABELS).map(({ value, label }) => ({ value, label: `Sort: ${label}` }));

/** The chip's words. They pulse from the tap until the filtered list arrives, so a slow answer isn't a dead tap. */
function ChipLabel({ label, selected }: { label: string; selected: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-busy={pending || undefined} className={cn("inline-flex items-center gap-1.5", pending && "animate-pulse")}>
      {selected && <Icon name="check" className="size-4 shrink-0" />}
      {label}
    </span>
  );
}

// The quick filters and the sort of Pets for You and Homes for You (MT-01, MT-02). Both only change the URL; the
// page reads it on the server and loads the matches, so every view can be linked and the back button undoes a
// filter. The filters are links, so they work before the page's JavaScript has loaded. They look like the choice
// chips of the quiz, with the same check on the one that is on.
export function MatchFilters({ kind, view }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // The select moves at once; the URL and the list catch up in a transition.
  const [sort, setSort] = useOptimistic(view.sort);

  const noun = kind === "pets" ? "pets" : "homes";
  const chips = [{ id: "", label: `All ${noun}` }, ...quickFiltersFor(kind)];

  function changeSort(next: MatchSort) {
    startTransition(() => {
      setSort(next);
      router.push(matchesHref({ ...view, sort: next, page: 1 }), { scroll: false });
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Quick filters">
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const selected = chip.id === view.show;
            return (
              <li key={chip.id}>
                <Link
                  href={matchesHref({ ...view, show: chip.id, page: 1 })}
                  aria-current={selected ? "true" : undefined}
                  scroll={false}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-pill border-[1.5px] px-4 text-sm font-bold md:min-h-9",
                    "transition-colors duration-200 ease-out",
                    selected
                      ? "border-primary bg-primary-soft text-primary-soft-ink"
                      : "border-line-strong bg-surface text-ink hover:border-ink-muted",
                  )}
                >
                  <ChipLabel label={chip.label} selected={selected} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Select
        aria-label={`Sort ${noun}`}
        value={sort}
        onChange={(event) => changeSort(event.target.value as MatchSort)}
        options={SORT_OPTIONS}
        className="w-full sm:w-52"
      />
    </div>
  );
}
