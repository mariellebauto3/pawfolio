"use client";

import { isApiError } from "@/lib/api/errors";
import { ErrorState, type ErrorKind, errorKindFromStatus } from "./error-state";

type Props = {
  /** As Next.js passes it to `error.tsx`. In production, errors from the server arrive without their message. */
  error: Error & { digest?: string };
  /** Next.js `retry`: fetches and renders the segment again. */
  retry: () => void;
};

// The body of every `error.tsx`: fixed, friendly copy by kind, never the error's own text (SEC-API-02).
export function RouteError({ error, retry }: Props) {
  const kind: ErrorKind = isApiError(error) ? errorKindFromStatus(error.status) : "server";
  // Trying again doesn't help with a missing page or one the account may not open.
  const canRetry = kind === "server" || kind === "network";
  return <ErrorState kind={kind} titleAs="h1" onRetry={canRetry ? retry : undefined} />;
}
