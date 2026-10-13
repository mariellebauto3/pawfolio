import { afterEach, expect, it, vi } from "vitest";
import { debouncedRequest } from "@/lib/api/debounced-request";

afterEach(() => vi.useRealTimers());

it("makes one request after typing stops, and cancels a timer on clearing or unmount", async () => {
  vi.useFakeTimers();
  const request = vi.fn(async () => "Ana Santos");
  const accept = vi.fn();
  let cancel = debouncedRequest(request, accept, vi.fn());
  await vi.advanceTimersByTimeAsync(100);
  cancel();
  cancel = debouncedRequest(request, accept, vi.fn());
  await vi.advanceTimersByTimeAsync(249);
  expect(request).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(request).toHaveBeenCalledTimes(1);
  expect(accept).toHaveBeenCalledWith("Ana Santos");
  cancel();
  const clear = debouncedRequest(request, accept, vi.fn());
  clear();
  await vi.advanceTimersByTimeAsync(500);
  expect(request).toHaveBeenCalledTimes(1);
});

it("ignores an obsolete response even when the transport does not honor cancellation", async () => {
  vi.useFakeTimers();
  let resolve!: (value: string) => void;
  let signal!: AbortSignal;
  const accept = vi.fn();
  const cancel = debouncedRequest((abort) => { signal = abort; return new Promise<string>((done) => { resolve = done; }); }, accept, vi.fn());
  await vi.advanceTimersByTimeAsync(250);
  cancel();
  expect(signal.aborted).toBe(true);
  debouncedRequest(async () => "New results", accept, vi.fn());
  await vi.advanceTimersByTimeAsync(250);
  resolve("Old results");
  await vi.advanceTimersByTimeAsync(0);
  expect(accept.mock.calls).toEqual([["New results"]]);
});
