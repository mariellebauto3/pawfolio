"use client";

import { useEffect, useId, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { api } from "@/lib/api/client";
import type { Query } from "@/lib/api/core";
import { debouncedRequest } from "@/lib/api/debounced-request";

export type SearchSuggestion = { id: string; name: string };
type Props = InputHTMLAttributes<HTMLInputElement> & {
  endpoint: string;
  query?: Query;
  readSuggestions: (data: unknown) => SearchSuggestion[];
  searchParam?: string;
};

/** Bounded suggestions shared by member and admin searches; submission remains the existing form's job. */
export function SearchSuggestions({ endpoint, query, readSuggestions, searchParam = "q", defaultValue, onChange, ...props }: Props) {
  const listId = useId();
  const [value, setValue] = useState(String(defaultValue ?? ""));
  const [answer, setAnswer] = useState<{ key: string; items: SearchSuggestion[] }>();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const words = value.trim().toLowerCase();
  const queryKey = JSON.stringify(query ?? {});
  const key = `${endpoint}|${queryKey}|${words.toLowerCase()}`;

  useEffect(() => {
    if (!words || !open) return;
    return debouncedRequest((signal) => api.get<{ data: unknown }>(endpoint, {
      query: { ...JSON.parse(queryKey), [searchParam]: words, suggestions: 1, per_page: 6, limit: 2 }, signal,
    }), (response) => setAnswer({ key, items: readSuggestions(response.data).slice(0, 6) }),
    () => setAnswer({ key, items: [] }));
  }, [endpoint, queryKey, key, words, searchParam, readSuggestions, open]);

  const items = words && answer?.key === key ? answer.items : [];
  const expanded = open && items.length > 0;
  function choose(item: SearchSuggestion) {
    setValue(item.name);
    setOpen(false);
    setActive(-1);
  }
  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    if (expanded && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      setActive((current) => current < 0 ? (event.key === "ArrowDown" ? 0 : items.length - 1)
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    }
    if (expanded && event.key === "Enter" && active >= 0) { event.preventDefault(); choose(items[active]); }
  }
  return <>
    <input {...props} value={value} role="combobox" aria-autocomplete="list" aria-expanded={expanded}
      aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
      onChange={(event) => { setValue(event.target.value); setOpen(true); setActive(-1); onChange?.(event); }}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={handleKey} />
    {expanded && <ul id={listId} role="listbox" aria-label="Search suggestions" className="absolute top-full left-0 z-30 mt-1 w-full rounded-xl border border-line bg-surface p-1 shadow-lg">
      {items.map((item, index) => <li key={item.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}
        className={`cursor-pointer rounded-lg px-3 py-2 text-sm hover:bg-primary/10 ${index === active ? "bg-primary/10" : ""}`}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)}>{item.name}</li>)}
    </ul>}
  </>;
}
