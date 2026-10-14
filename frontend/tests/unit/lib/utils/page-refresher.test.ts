import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REFRESH_GAP_MS, createPageRefresher } from "@/lib/utils/page-refresher";

// When the pages kept for quick navigation are dropped after a write: at once for the first one, and once more
// for the rest of a burst.

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("dropping kept pages after a write", () => {
  it("renders again at once after a write, so no page from before it is shown", () => {
    const refresh = vi.fn();
    createPageRefresher(refresh).noteWrite();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("answers a burst of writes with one more render, after the last of them", async () => {
    const refresh = vi.fn();
    const refresher = createPageRefresher(refresh);

    refresher.noteWrite();
    await vi.advanceTimersByTimeAsync(200);
    refresher.noteWrite();
    await vi.advanceTimersByTimeAsync(300);
    refresher.noteWrite();
    expect(refresh).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(REFRESH_GAP_MS - 500);
    expect(refresh).toHaveBeenCalledTimes(2);

    // Nothing was written since: nothing more is asked.
    await vi.advanceTimersByTimeAsync(REFRESH_GAP_MS * 3);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("renders at once again for a write that comes after the gap", async () => {
    const refresh = vi.fn();
    const refresher = createPageRefresher(refresh);

    refresher.noteWrite();
    await vi.advanceTimersByTimeAsync(REFRESH_GAP_MS);
    refresher.noteWrite();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("asks nothing more once it is stopped", async () => {
    const refresh = vi.fn();
    const refresher = createPageRefresher(refresh);

    refresher.noteWrite();
    refresher.noteWrite();
    refresher.stop();
    await vi.advanceTimersByTimeAsync(REFRESH_GAP_MS * 2);
    expect(refresh).toHaveBeenCalledOnce();
  });
});
