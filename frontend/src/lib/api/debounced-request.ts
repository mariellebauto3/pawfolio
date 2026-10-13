/** Cleanup stops both the pending timer and an in-flight answer, even if transport ignores abort. */
export function debouncedRequest<T>(request: (signal: AbortSignal) => Promise<T>, accept: (value: T) => void, reject: () => void, delay = 250): () => void {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    request(controller.signal).then((value) => {
      if (!controller.signal.aborted) accept(value);
    }).catch(() => {
      if (!controller.signal.aborted) reject();
    });
  }, delay);
  return () => { clearTimeout(timer); controller.abort(); };
}
