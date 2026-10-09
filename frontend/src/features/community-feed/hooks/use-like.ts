"use client";

import { useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import type { ReactionState } from "../types/feed";

const UNKNOWN_PROBLEM = "We couldn't count your like. Check your connection and try again.";

/**
 * The like on a post or a comment (FD-01, FD-05). Whoever holds the post holds the like, so this hook only moves
 * it: pressing shows the new state at once, the API's answer then sets the true count, and a refusal puts back what
 * was there and says why. A second press while the first is on its way is ignored, so two quick taps can't leave
 * the heart and the server disagreeing.
 */
export function useLike(current: ReactionState, send: () => Promise<ReactionState>, onChange: (next: ReactionState) => void) {
  const toast = useToast();
  const sending = useRef(false);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    const before = current;
    onChange({ has_reacted: !before.has_reacted, reactions_count: Math.max(before.reactions_count + (before.has_reacted ? -1 : 1), 0) });
    try {
      onChange(await send());
    } catch (problem) {
      onChange(before);
      toast.show(isApiError(problem) ? problem.message : UNKNOWN_PROBLEM, { tone: "error" });
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  return { liked: current.has_reacted, count: current.reactions_count, pending, toggle };
}
