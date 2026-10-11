import { ApiError, isApiError, networkError, normalizeApiError } from "@/lib/api/errors";

// The transport-agnostic part of the API client. A transport sends one request (to Laravel from the browser, to
// Laravel from the server, or to the mock fixtures) and returns the raw status and body; the client turns non-2xx
// answers into ApiError. Screens and feature `api/` folders use `api` from "@/lib/api/client" (browser) or
// `getServerApi()` from "@/lib/api/server" (Server Components), never fetch() directly.

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;
export type Query = Record<string, QueryValue>;

export type RequestOptions = {
  query?: Query;
  signal?: AbortSignal;
  /**
   * Don't hand 401 / account-not-active errors to the session provider's redirect. Use it where those answers are
   * expected and handled on the spot: loading the session, signing in.
   */
  skipAuthRedirect?: boolean;
};

export type FileRequestOptions = RequestOptions & {
  /**
   * The media types the caller can show safely, e.g. `["image/jpeg", "image/png", "application/pdf"]`. Any other
   * answer is refused: a file shown from a blob: URL runs with this site's origin, so an HTML or SVG file stored as
   * an "ID" must never get that far (SEC-FE-09).
   */
  accept: readonly string[];
};

export type TransportRequest = {
  method: HttpMethod;
  /** Path under /api/v1, starting with "/", e.g. "/adoption-requests/12/approve". */
  path: string;
  query?: Query;
  /** A plain object is sent as JSON; FormData is sent as multipart (uploads). */
  body?: unknown;
  signal?: AbortSignal;
  /** `blob` when a 2xx answer is a file to hand over as it is. Errors are JSON either way. Default `json`. */
  responseType?: "json" | "blob";
};

export type TransportResponse = {
  status: number;
  /** Parsed JSON, a Blob when one was asked for, or null when the response had no body to read. */
  body: unknown;
  retryAfter: string | null;
};

export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

export type ApiClient = {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T = void>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T = void>(path: string, options?: RequestOptions): Promise<T>;
  /** A file the API serves to this account only (verification documents). Resolves to a Blob of an accepted type. */
  getFile(path: string, options: FileRequestOptions): Promise<Blob>;
};

export type ApiErrorListener = (error: ApiError) => void;

type ClientOptions = {
  /** Called for every ApiError unless the call sets `skipAuthRedirect`. */
  onError?: ApiErrorListener;
};

export function createApiClient(transport: Transport, { onError }: ClientOptions = {}): ApiClient {
  async function request<T>(
    method: HttpMethod,
    path: string,
    body: unknown,
    { query, signal, skipAuthRedirect = false }: RequestOptions = {},
    responseType: TransportRequest["responseType"] = "json",
  ): Promise<T> {
    assertSafePath(path);
    let response: TransportResponse;
    try {
      response = await transport({ method, path, query, body, signal, responseType });
    } catch (cause) {
      // The caller cancelled the request (or its own timeout fired): not an error to show, so pass it on as-is.
      if (signal?.aborted || isAbortError(cause)) throw cause;
      // fetch() rejects with a TypeError when there is no answer at all (offline, DNS, CORS). Anything else that
      // isn't already an ApiError is a bug and should surface as one, not hide behind "couldn't reach Pawfolio".
      if (!isApiError(cause) && !(cause instanceof TypeError)) throw cause;
      const error = isApiError(cause) ? cause : networkError();
      if (!skipAuthRedirect) onError?.(error);
      throw error;
    }

    if (response.status >= 200 && response.status < 300) return response.body as T;

    const error = normalizeApiError(response.status, response.body, response.retryAfter);
    if (!skipAuthRedirect) onError?.(error);
    throw error;
  }

  async function getFile(path: string, { accept, ...options }: FileRequestOptions): Promise<Blob> {
    const file = await request<unknown>("GET", path, undefined, options, "blob");
    const type = file instanceof Blob ? mediaType(file.type) : "";
    if (!(file instanceof Blob) || !accept.includes(type)) {
      throw new ApiError({ kind: "server", status: 200, message: "We couldn't open that file." });
    }
    // A copy that carries the checked type and nothing else, so that is the type the browser shows it as.
    return file.slice(0, file.size, type);
  }

  return {
    getFile,
    get: (path, options) => request("GET", path, undefined, options),
    post: (path, body, options) => request("POST", path, body, options),
    put: (path, body, options) => request("PUT", path, body, options),
    patch: (path, body, options) => request("PATCH", path, body, options),
    delete: (path, options) => request("DELETE", path, undefined, options),
  };
}

export function isWriteMethod(method: HttpMethod): boolean {
  return method !== "GET";
}

/**
 * Builds an API path from a template, encoding every value: apiPath`/adoption-requests/${requestId}/withdraw`.
 * Use it whenever a path contains an id or any other value, especially one read from the page URL.
 */
export function apiPath(strings: TemplateStringsArray, ...values: ReadonlyArray<string | number>): string {
  return strings.reduce((path, part, index) => {
    const value = index < values.length ? encodeURIComponent(String(values[index])) : "";
    return path + part + value;
  }, "");
}

/**
 * Refuses a path that the URL parser would change: ".." and "." segments and backslashes are resolved, and "?" and
 * "#" move out of the path.
 * Any change means a value inside the path could steer the request — with the user's cookies and CSRF token — to
 * another endpoint (client-side path traversal, SEC-FE-08).
 */
export function assertSafePath(path: string): void {
  const expected = `/api/v1${path}`;
  const url = new URL(expected, "http://api.invalid");
  if (!path.startsWith("/") || path.startsWith("//") || url.pathname !== expected || url.search || url.hash) {
    throw new Error(`Unsafe API path "${path}". Build paths with apiPath\`…\` and pass query values in { query }.`);
  }
}

/** `${apiUrl}/api/v1${path}?query`. Booleans become 1/0 and arrays `key[]=…`, the forms Laravel validation reads. */
export function buildApiUrl(apiUrl: string, path: string, query?: Query): string {
  assertSafePath(path);
  const url = new URL(`${apiUrl}/api/v1${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(`${key}[]`, String(item));
    } else if (typeof value === "boolean") {
      url.searchParams.set(key, value ? "1" : "0");
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Headers every request to Laravel carries: JSON answers, and errors as JSON instead of HTML or redirects. */
export function baseHeaders(): Headers {
  return new Headers({ Accept: "application/json", "X-Requested-With": "XMLHttpRequest" });
}

/** Encodes the body and sets Content-Type when needed. FormData keeps the browser's multipart boundary. */
export function encodeBody(body: unknown, headers: Headers): BodyInit | undefined {
  if (body === undefined) return undefined;
  if (body instanceof FormData) return body;
  headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
}

/** "image/jpeg" from "Image/JPEG; charset=binary": the type without its parameters, in lower case. */
function mediaType(contentType: string): string {
  return contentType.split(";")[0].trim().toLowerCase();
}

export async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return null;
  if (!response.headers.get("Content-Type")?.includes("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
