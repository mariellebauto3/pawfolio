// One account per browser: every tab shares the same session cookie, so when one tab logs out or another account
// signs in, a tab that still shows the first account would act as the second one with its next click. These
// helpers let the SessionProvider notice and leave such a page. They are a convenience for the person at the
// screen; the API already answers every request for the account the session really belongs to (SEC-FE-05).

/** What happened to the session since the page was rendered, by comparing who it shows with who the API says. */
export type SessionChange = "none" | "signed-in" | "signed-out" | "switched";

export function sessionChange(shownAccountId: number | null, currentAccountId: number | null): SessionChange {
  if (shownAccountId === currentAccountId) return "none";
  if (shownAccountId === null) return "signed-in";
  if (currentAccountId === null) return "signed-out";
  return "switched";
}

/** 409 `code` the API sends when a signed-in browser tries to sign in again (docs/api/auth.md). */
export const ALREADY_SIGNED_IN_CODE = "already_signed_in";

const CHANNEL_NAME = "pawfolio-session";
/** The whole message: no account, no name, nothing to read (SEC-FE-04). Each tab asks the API itself. */
const CHANGED = "changed";

// One channel for the tab, used both to tell and to listen: a channel never hears its own messages, so the tab
// that logs out isn't told to check a session it is ending itself.
let channel: BroadcastChannel | null | undefined;

function sessionChannel(): BroadcastChannel | null {
  if (channel === undefined) channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

/** Tells this browser's other tabs that the session was started or ended here, so they check theirs now. */
export function announceSessionChange(): void {
  sessionChannel()?.postMessage(CHANGED);
}

/** Runs `listener` when another tab announces a change. Returns the function that stops listening. */
export function onSessionChangeElsewhere(listener: () => void): () => void {
  const shared = sessionChannel();
  if (!shared) return () => {};
  const onMessage = (event: MessageEvent) => {
    if (event.data === CHANGED) listener();
  };
  shared.addEventListener("message", onMessage);
  return () => shared.removeEventListener("message", onMessage);
}
