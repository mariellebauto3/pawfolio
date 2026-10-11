"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { getAdoption } from "../api/adoptions";
import type { AdoptionRecord } from "../types/adoptions";

const UNKNOWN_PROBLEM = "We couldn't load the adoption details. Please try again.";

export type AdoptionRecordState =
  | { status: "idle" | "loading"; retry: () => void }
  | { status: "ready"; record: AdoptionRecord; retry: () => void }
  /** `gone`: the API has no such adoption for this reader (404), so trying again won't help. */
  | { status: "error"; message: string; gone: boolean; retry: () => void };

type Loaded = { key: string } & ({ record: AdoptionRecord } | { message: string; gone: boolean });

/**
 * One adoption record (AL-06), read when its dialog first opens (`enabled`). What was read is kept while the button
 * is on the page, so opening the dialog again shows it at once. It holds a cover letter, so it stays in memory only
 * and is never written to browser storage (SEC-FE-04).
 */
export function useAdoptionRecord(adoptionId: number, enabled: boolean): AdoptionRecordState {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${adoptionId}/${attempt}`;
  const current = loaded?.key === key ? loaded : null;
  const settled = current !== null;

  useEffect(() => {
    if (!enabled || settled) return;
    const controller = new AbortController();

    getAdoption(api, adoptionId, controller.signal).then(
      (record) => {
        if (!controller.signal.aborted) setLoaded({ key, record });
      },
      (problem: unknown) => {
        if (controller.signal.aborted) return;
        const known = isApiError(problem);
        setLoaded({ key, message: known ? problem.message : UNKNOWN_PROBLEM, gone: known && problem.kind === "not_found" });
      },
    );

    // Closing the dialog before the answer arrives drops the request; opening it again asks afresh.
    return () => controller.abort();
  }, [adoptionId, enabled, settled, key]);

  const retry = () => setAttempt((count) => count + 1);
  if (current && "record" in current) return { status: "ready", record: current.record, retry };
  if (current) return { status: "error", message: current.message, gone: current.gone, retry };
  return { status: enabled ? "loading" : "idle", retry };
}
