"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { suggestHomes, suggestPets } from "../api/discovery";
import {
  BROWSE_SUGGESTION_COUNT,
  BROWSE_SUGGESTION_DELAY_MS,
  type BrowseFilters,
  type BrowseKind,
  type Suggestion,
  browsePanelKey,
  homeSuggestion,
  petSuggestion,
  rankByName,
} from "../schemas/browse-filters";

export type Suggestions = {
  /** `idle`: nothing typed. `loading`: asked, no answer for these words yet. `error`: the API couldn't say. */
  status: "idle" | "loading" | "ready" | "error";
  /** The first few names that hold what was typed, the ones that start with it first. While loading, the last answer's. */
  items: Suggestion[];
  /** How many names match in all, to say when there are more than the few shown. */
  total: number;
};

type Answer = { key: string; items: Suggestion[]; total: number; failed: boolean };

const NOTHING: Answer = { key: "", items: [], total: 0, failed: false };

/**
 * The names that match what is being typed in Browse's search box (DS-01, DS-02), for the list that drops down
 * under it: "ki" already shows Kimchi. It asks the same endpoint as the page for names only, with the filters that
 * are applied, a moment after the last key, and drops an answer that a newer key has overtaken. Only pets looking
 * for a home and homes that are Open to Adopt can come back: the API lists nobody else (proposal §5).
 */
export function useBrowseSuggestions(kind: BrowseKind, filters: BrowseFilters, typed: string): Suggestions {
  const [answer, setAnswer] = useState<Answer>(NOTHING);
  // The filters as they are now, read when the request is made. The effect itself runs only for new words or a
  // new filter, not for every render that hands over an equal `filters` object.
  const latest = useRef(filters);
  useEffect(() => {
    latest.current = filters;
  });

  const key = typed === "" ? "" : `${kind}|${browsePanelKey(kind, filters)}|${typed}`;

  useEffect(() => {
    if (key === "") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const asked = { ...latest.current, search: typed, page: 1 };
      const request =
        kind === "pets"
          ? suggestPets(api, asked, controller.signal).then((page) => ({ total: page.meta.total, items: rankByName(typed, page.data, (pet) => pet.name).map(petSuggestion) }))
          : suggestHomes(api, asked, controller.signal).then((page) => ({ total: page.meta.total, items: rankByName(typed, page.data, (home) => home.full_name).map(homeSuggestion) }));

      request
        .then(({ total, items }) => {
          if (!controller.signal.aborted) setAnswer({ key, total, items: items.slice(0, BROWSE_SUGGESTION_COUNT), failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted) setAnswer({ key, total: 0, items: [], failed: true });
        });
    }, BROWSE_SUGGESTION_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [key, kind, typed]);

  if (key === "") return { status: "idle", items: [], total: 0 };
  // Until the answer for these words is in, the last answer's names that still hold them stand in: typing "pe"
  // after "p" keeps Pepper on screen and drops the names without "pe", instead of an empty list for a moment.
  if (answer.key !== key) {
    const still = answer.items.filter((item) => item.name.toLowerCase().includes(typed.toLowerCase()));
    return { status: "loading", items: still, total: still.length };
  }
  return { status: answer.failed ? "error" : "ready", items: answer.items, total: answer.total };
}
