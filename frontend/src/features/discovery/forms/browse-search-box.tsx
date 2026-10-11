"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useId, useState } from "react";
import { CONTROL_CLASSES } from "@/components/forms/control-styles";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useBrowseSuggestions } from "../hooks/use-browse-suggestions";
import { BROWSE_PARAMS, BROWSE_SEARCH_MAX, type BrowseFilters, type BrowseKind, splitAtMatch } from "../schemas/browse-filters";

type Props = {
  id: string;
  kind: BrowseKind;
  /** The filters the results on the page were loaded with: suggestions are narrowed by them too. */
  filters: BrowseFilters;
  /** What is typed in the box. */
  value: string;
  onChange: (value: string) => void;
};

// Browse's search box with its suggestions (DS-01, DS-02): as soon as a letter is typed, the names that hold it
// drop down under the box, the ones that start with it first, so "ki" already offers Kimchi. Choosing one opens that
// resume or Home Profile; carrying on typing, or Enter with nothing chosen, narrows the cards below as before.
//
// A combobox with a list (WAI-ARIA APG): ↓ and ↑ move through the suggestions, Enter opens the one that is
// highlighted, Escape closes the list and keeps what was typed. One suggestion at most is highlighted, the one
// Enter would open, whether the arrow keys or the pointer got there (ui-guidelines §5). Names and details are text
// from the API and are rendered as text (SEC-FE-01).
export function BrowseSearchBox({ id, kind, filters, value, onChange }: Props) {
  const router = useRouter();
  const listId = useId();
  const typed = value.trim();
  const { status, items, total } = useBrowseSuggestions(kind, filters, typed);

  const [focused, setFocused] = useState(false);
  // What was typed when the list was closed with Escape or by choosing: it stays closed until the words change.
  const [closedFor, setClosedFor] = useState<string | null>(null);
  // The highlighted suggestion, remembered with the words it belongs to, so new words start with none.
  const [active, setActive] = useState<{ typed: string; index: number } | null>(null);

  const open = focused && typed !== "" && closedFor !== typed;
  const index = active && active.typed === typed && active.index < items.length ? active.index : -1;
  const nouns = kind === "pets" ? "pets" : "homes";
  const optionId = (i: number) => `${listId}-option-${i}`;

  function choose(i: number) {
    const suggestion = items[i];
    if (!suggestion) return;
    setClosedFor(typed);
    router.push(suggestion.href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (items.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      // From the box itself, ↓ starts at the first suggestion and ↑ at the last; past either end is the box again.
      const next = index === -1 ? (step === 1 ? 0 : items.length - 1) : index + step;
      setActive(next < 0 || next >= items.length ? null : { typed, index: next });
    } else if (event.key === "Enter" && index !== -1) {
      // Otherwise Enter is the form's: it shows the results for what is typed.
      event.preventDefault();
      choose(index);
    } else if (event.key === "Escape") {
      // A search box empties itself on Escape; here the first Escape only closes the list.
      event.preventDefault();
      setClosedFor(typed);
    }
  }

  return (
    <div className="relative min-w-0 flex-1 basis-full md:basis-0">
      <label htmlFor={id} className="sr-only">
        Search {nouns}
      </label>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" />
      <input
        id={id}
        name={BROWSE_PARAMS.search}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && index !== -1 ? optionId(index) : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={kind === "pets" ? "Search by name, breed or city" : "Search by name or city"}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={BROWSE_SEARCH_MAX}
        className={cn(CONTROL_CLASSES, "pl-10")}
      />

      {open && (
        <div
          // Pressing inside the list must not take focus from the box, or the list would close before the press lands.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 z-(--pf-z-dropdown) mt-2 animate-menu-in rounded-card border border-line bg-surface p-1.5 shadow-menu"
        >
          <ul id={listId} role="listbox" aria-label={`Matching ${nouns}`} onPointerLeave={() => setActive(null)}>
            {items.map((suggestion, i) => {
              const [before, match, after] = splitAtMatch(suggestion.name, typed);
              return (
                <li
                  key={suggestion.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === index}
                  onPointerMove={() => i !== index && setActive({ typed, index: i })}
                  onClick={() => choose(i)}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2.5 py-2 transition-colors duration-150",
                    i === index && "bg-surface-sunken",
                  )}
                >
                  <Avatar name={suggestion.name} src={suggestion.photo ?? undefined} alt="" size="sm" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      {before}
                      <strong className="font-bold">{match}</strong>
                      {after}
                    </span>
                    {suggestion.detail && <span className="truncate text-sm text-ink-muted">{suggestion.detail}</span>}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Read out as the list changes, since nothing else tells a screen reader that it did. */}
          <p role="status" className={cn("px-2.5 py-2 text-sm text-ink-muted", items.length > 0 && "mt-1 border-t border-line")}>
            {items.length === 0 && status === "loading" && "Searching…"}
            {items.length === 0 && status === "error" && "Suggestions couldn’t load. Press Enter to search."}
            {items.length === 0 &&
              status === "ready" &&
              (kind === "pets"
                ? `No pet looking for a home has “${typed}” in its name. Pets that are In Process or were adopted aren’t listed.`
                : `No home that is Open to Adopt has “${typed}” in its name.`)}
            {items.length > 0 &&
              (total > items.length
                ? `${items.length} of ${total} names that match. Keep typing to narrow them.`
                : `Choose a name to open it. The results below also match ${kind === "pets" ? "breeds and cities" : "cities"}.`)}
          </p>
        </div>
      )}
    </div>
  );
}
