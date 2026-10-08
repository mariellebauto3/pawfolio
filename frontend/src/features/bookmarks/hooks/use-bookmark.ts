"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import { removeBookmark, saveBookmark } from "../api/bookmarks";
import type { BookmarkTarget } from "../types/bookmarks";

const UNKNOWN_PROBLEM = "We couldn't update your bookmarks. Check your connection and try again.";

/**
 * One profile's bookmark: whether it is saved, and saving or removing it with the toast that confirms either
 * (BM-03). The answer decides what shows: `saved` only changes once the API has agreed (SEC-FE-05), and a refusal
 * is shown in its own words.
 */
export function useBookmark(target: BookmarkTarget, initiallySaved: boolean, onChange?: (saved: boolean) => void) {
  const toast = useToast();
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, setPending] = useState(false);

  async function set(next: boolean) {
    if (pending) return;
    setPending(true);
    try {
      await (next ? saveBookmark(api, target) : removeBookmark(api, target));
      setSaved(next);
      toast.show(next ? "Saved to Bookmarks." : "Removed from Bookmarks.");
      onChange?.(next);
    } catch (problem) {
      toast.show(isApiError(problem) ? problem.message : UNKNOWN_PROBLEM, { tone: "error" });
    } finally {
      setPending(false);
    }
  }

  return { saved, pending, save: () => set(true), remove: () => set(false), toggle: () => set(!saved) };
}
