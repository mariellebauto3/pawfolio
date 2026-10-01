// Shapes of Laravel API Resource responses (backend-guidelines.md §2). Field names stay snake_case, exactly as the
// API sends them, so types match docs/api/ one to one (ADR 0004).

/** ISO 8601 date-time string from the API, e.g. "2026-10-01T09:30:00.000000Z". */
export type IsoDateTime = string;

/** ISO 8601 date without a time, e.g. "2001-04-18". */
export type IsoDate = string;

/** A single item: `{ "data": … }`. */
export type ApiResource<T> = {
  data: T;
};

/** A paginated list: Laravel's resource collection shape. Every list is paginated (SEC-API-05). */
export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
  links: PaginationLinks;
};

export type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  /** Position of the first and last item on this page; null when the page is empty. */
  from: number | null;
  to: number | null;
  path: string;
};

export type PaginationLinks = {
  first: string | null;
  last: string | null;
  prev: string | null;
  next: string | null;
};

/** Error body sent with 4xx responses (backend-guidelines.md §2, docs/api/README.md). */
export type ApiErrorBody = {
  message?: string;
  /** Machine-readable reason, e.g. `account_not_active` (403) or `open_request_limit` (409). */
  code?: string;
  /** 422 only: field name → messages. Array fields use dotted names (`photos.0`). */
  errors?: Record<string, string[]>;
};
