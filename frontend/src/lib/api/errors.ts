import type { ApiErrorBody } from "@/types/api";

// Every failed API call becomes one ApiError, so screens handle errors the same way whatever the endpoint:
//   401 unauthenticated      → the session provider sends the user to sign-in
//   403 account_not_active   → the session provider sends the user to the account-status screen
//   403 forbidden            → show `message`
//   404 not_found            → show a not-found state (also used for records the user may not see, SEC-AUTHZ-04)
//   409 conflict             → show `message`: the business rule that blocked the action (e.g. 3 open requests)
//   422 validation           → show `fieldErrors` next to each field
//   413 payload_too_large    → show `message` (an upload over the size limit)
//   other 4xx bad_request, 419 session_expired, 429 rate_limited, 5xx server, network → show `message`
// Messages are always user-friendly; raw server text is only used where the API promises friendly copy, and never
// for 5xx (it could contain debug output, SEC-API-02).

export type ApiErrorKind =
  | "unauthenticated"
  | "account_not_active"
  | "forbidden"
  | "not_found"
  | "session_expired"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "payload_too_large"
  | "bad_request"
  | "server"
  | "network";

/** Field name (as the API names it, e.g. `cover_letter`, `photos.0`) → first error message for that field. */
export type FieldErrors = Record<string, string>;

/** 403 `code` the backend sends when the account is not Active (SEC-AUTHZ-06). Other 403s are plain `forbidden`. */
export const ACCOUNT_NOT_ACTIVE_CODE = "account_not_active";

const MAX_SERVER_MESSAGE_LENGTH = 300;

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  unauthenticated: "Please sign in to continue.",
  account_not_active: "Your account can't do this until it's active.",
  forbidden: "You don't have access to this.",
  not_found: "We couldn't find what you were looking for.",
  session_expired: "Your session expired. Please try again.",
  conflict: "This can't be done right now.",
  validation: "Please check the highlighted fields.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  payload_too_large: "That file is too large. Choose a smaller one and try again.",
  bad_request: "That didn't work. Please check what you entered and try again.",
  server: "Something went wrong on our side. Please try again.",
  network: "We couldn't reach Pawfolio. Check your connection and try again.",
};

// Kinds whose server `message` is written for users and worth showing as-is.
const SERVER_MESSAGE_KINDS = new Set<ApiErrorKind>(["account_not_active", "forbidden", "conflict", "rate_limited"]);

type ApiErrorInit = {
  kind: ApiErrorKind;
  status: number;
  message: string;
  code?: string | null;
  fieldErrors?: FieldErrors;
  retryAfterSeconds?: number | null;
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** HTTP status; 0 when the request never got a response. */
  readonly status: number;
  /** Machine-readable reason from the API body, e.g. `open_request_limit`, for screens that show a specific dialog. */
  readonly code: string | null;
  readonly fieldErrors: FieldErrors;
  /** From `Retry-After` on 429, e.g. the sign-in lockout (AU-03). */
  readonly retryAfterSeconds: number | null;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code ?? null;
    this.fieldErrors = init.fieldErrors ?? {};
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Turns a non-2xx response into an ApiError. `body` is the parsed JSON (or null when there was none). */
export function normalizeApiError(status: number, body: unknown, retryAfter?: string | null): ApiError {
  const parsed = readErrorBody(body);
  const kind = kindForStatus(status, parsed.code);
  const serverMessage = SERVER_MESSAGE_KINDS.has(kind) ? friendlyServerMessage(parsed.message) : null;

  return new ApiError({
    kind,
    status,
    message: serverMessage ?? DEFAULT_MESSAGES[kind],
    code: parsed.code,
    fieldErrors: kind === "validation" ? toFieldErrors(parsed.errors) : {},
    retryAfterSeconds: kind === "rate_limited" ? parseRetryAfter(retryAfter) : null,
  });
}

/** The request never got a response: offline, DNS, CORS rejection, or the server is down. */
export function networkError(): ApiError {
  return new ApiError({ kind: "network", status: 0, message: DEFAULT_MESSAGES.network });
}

function kindForStatus(status: number, code: string | null): ApiErrorKind {
  switch (status) {
    case 401:
      return "unauthenticated";
    case 403:
      return code === ACCOUNT_NOT_ACTIVE_CODE ? "account_not_active" : "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 419:
      return "session_expired";
    case 422:
      return "validation";
    case 413:
      return "payload_too_large";
    case 429:
      return "rate_limited";
    default:
      // Our own 4xx answers are covered above; anything else in 4xx is still a problem with the request, not the server.
      return status >= 400 && status < 500 ? "bad_request" : "server";
  }
}

type ParsedErrorBody = { message: string | null; code: string | null; errors: unknown };

function readErrorBody(body: unknown): ParsedErrorBody {
  if (typeof body !== "object" || body === null) return { message: null, code: null, errors: null };
  const { message, code, errors } = body as ApiErrorBody;
  return {
    message: typeof message === "string" ? message : null,
    code: typeof code === "string" ? code : null,
    errors,
  };
}

function friendlyServerMessage(message: string | null): string | null {
  const trimmed = message?.trim();
  if (!trimmed || trimmed.length > MAX_SERVER_MESSAGE_LENGTH) return null;
  return trimmed;
}

function toFieldErrors(errors: unknown): FieldErrors {
  if (typeof errors !== "object" || errors === null) return {};
  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(errors)) {
    const first = Array.isArray(messages) ? messages.find((m) => typeof m === "string") : messages;
    if (typeof first === "string" && first.trim()) result[field] = first;
  }
  return result;
}

function parseRetryAfter(value: string | null | undefined): number | null {
  if (!value) return null;
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : null;
}
