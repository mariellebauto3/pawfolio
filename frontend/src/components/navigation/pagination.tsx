import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type SearchParams = Record<string, string | string[] | undefined>;

type Props = {
  /** Current page, 1-based (Laravel's `meta.current_page`). */
  page: number;
  /** Laravel's `meta.last_page`. Nothing renders when there is only one page. */
  totalPages: number;
  /** The page's current `searchParams`, so tabs and filters stay in the links. */
  searchParams?: SearchParams;
  param?: string;
  /** Names the navigation: "Pagination", "Pages of requests". */
  label?: string;
  className?: string;
};

/** Page numbers to show: always the first and last, and one either side of the current page; gaps become "…". */
export function pageWindow(page: number, totalPages: number): Array<number | "gap"> {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  pages.forEach((n, i) => {
    const previous = pages[i - 1];
    if (previous !== undefined && n - previous === 2) result.push(previous + 1);
    else if (previous !== undefined && n - previous > 2) result.push("gap");
    result.push(n);
  });
  return result;
}

const STEP =
  "inline-flex min-h-11 items-center gap-1 rounded-pill px-3 text-sm font-bold md:min-h-9 transition-colors duration-200";

// Links, not buttons: the page reads `?page=` on the server and every page has its own URL.
// Phones show "Page 2 of 8" between Previous and Next instead of the numbers.
export function Pagination({ page, totalPages, searchParams = {}, param = "page", label = "Pagination", className }: Props) {
  if (totalPages <= 1) return null;
  const current = Math.min(Math.max(page, 1), totalPages);

  function href(target: number) {
    const query: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && key !== param) query[key] = value;
    }
    if (target > 1) query[param] = String(target);
    return { query };
  }

  const previous =
    current > 1 ? (
      <Link href={href(current - 1)} className={cn(STEP, "text-primary hover:bg-primary-soft")}>
        <Icon name="chevron-left" className="size-4" />
        Previous
      </Link>
    ) : (
      <span aria-disabled="true" className={cn(STEP, "text-ink-muted")}>
        <Icon name="chevron-left" className="size-4" />
        Previous
      </span>
    );

  const next =
    current < totalPages ? (
      <Link href={href(current + 1)} className={cn(STEP, "text-primary hover:bg-primary-soft")}>
        Next
        <Icon name="chevron-right" className="size-4" />
      </Link>
    ) : (
      <span aria-disabled="true" className={cn(STEP, "text-ink-muted")}>
        Next
        <Icon name="chevron-right" className="size-4" />
      </span>
    );

  return (
    <nav aria-label={label} className={cn("flex items-center justify-between gap-2 md:justify-center", className)}>
      {previous}
      <p className="text-sm text-ink-muted md:hidden">
        Page {current} of {totalPages}
      </p>
      <ol className="hidden items-center gap-1 md:flex">
        {pageWindow(current, totalPages).map((item, i) =>
          item === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-muted">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={href(item)}
                aria-label={`Page ${item}`}
                aria-current={item === current ? "page" : undefined}
                className={cn(
                  "grid size-9 place-items-center rounded-pill text-sm font-bold tabular-nums no-underline",
                  "transition-colors duration-200",
                  item === current ? "bg-primary text-primary-ink" : "text-ink hover:bg-surface-sunken",
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>
      {next}
    </nav>
  );
}
