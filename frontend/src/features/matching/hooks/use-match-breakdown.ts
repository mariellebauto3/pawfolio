"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { getMatchBreakdown } from "../api/matching";
import type { MatchBreakdown } from "../types/matching";

const UNKNOWN_PROBLEM = "We couldn't load this breakdown. Please try again.";

export type BreakdownState =
  | { status: "idle" | "loading"; retry: () => void }
  | { status: "ready"; breakdown: MatchBreakdown; retry: () => void }
  /** `gone`: the API has no score for this pair any more (404), so trying again won't help. */
  | { status: "error"; message: string; gone: boolean; retry: () => void };

type Loaded = { key: string } & ({ breakdown: MatchBreakdown } | { message: string; gone: boolean });

/**
 * The breakdown of the viewer's match with one profile (MT-03), read when its dialog first opens (`enabled`). What
 * was read is kept while the card is on the page, so opening the dialog again shows it at once.
 */
export function useMatchBreakdown(profileId: number, enabled: boolean): BreakdownState {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${profileId}/${attempt}`;
  const current = loaded?.key === key ? loaded : null;
  const settled = current !== null;

  useEffect(() => {
    if (!enabled || settled) return;
    const controller = new AbortController();

    getMatchBreakdown(api, profileId, controller.signal).then(
      (breakdown) => {
        if (!controller.signal.aborted) setLoaded({ key, breakdown });
      },
      (problem: unknown) => {
        if (controller.signal.aborted) return;
        const known = isApiError(problem);
        setLoaded({ key, message: known ? problem.message : UNKNOWN_PROBLEM, gone: known && problem.kind === "not_found" });
      },
    );

    // Closing the dialog before the answer arrives drops the request; opening it again asks afresh.
    return () => controller.abort();
  }, [profileId, enabled, settled, key]);

  const retry = () => setAttempt((count) => count + 1);
  if (current && "breakdown" in current) return { status: "ready", breakdown: current.breakdown, retry };
  if (current) return { status: "error", message: current.message, gone: current.gone, retry };
  return { status: enabled ? "loading" : "idle", retry };
}
