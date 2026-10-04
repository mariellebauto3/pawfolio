"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { getVerificationDocument } from "../api/verification-review";

const UNKNOWN_PROBLEM = "We couldn't open that file.";

export type DocumentFile =
  | { status: "idle" | "loading"; retry: () => void }
  | { status: "ready"; url: string; type: string; retry: () => void }
  | { status: "error"; message: string; retry: () => void };

type Loaded = { key: string } & ({ url: string; type: string } | { message: string });

/**
 * One verification document, read with the admin's session and shown from memory (AU-23, AU-24). The `blob:` address
 * only works in this tab and is dropped when the screen closes, so the file never has a link that could be shared,
 * cached or left in the history (SEC-PRIV-01). Loads once `enabled` is true.
 */
export function useDocumentFile(accountId: number, documentId: number, enabled = true): DocumentFile {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${accountId}/${documentId}/${attempt}`;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let url: string | null = null;

    getVerificationDocument(api, accountId, documentId, controller.signal).then(
      (file) => {
        if (controller.signal.aborted) return;
        url = URL.createObjectURL(file);
        setLoaded({ key, url, type: file.type });
      },
      (problem: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({ key, message: isApiError(problem) ? problem.message : UNKNOWN_PROBLEM });
      },
    );

    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [accountId, documentId, enabled, key]);

  const retry = () => setAttempt((count) => count + 1);
  if (!enabled) return { status: "idle", retry };
  // Only what was loaded for this document and this attempt counts; anything older has been released.
  if (loaded?.key !== key) return { status: "loading", retry };
  return "url" in loaded ? { status: "ready", url: loaded.url, type: loaded.type, retry } : { status: "error", message: loaded.message, retry };
}
