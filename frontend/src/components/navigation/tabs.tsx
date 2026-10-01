"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type KeyboardEvent,
  type ReactNode,
  Suspense,
  useId,
  useOptimistic,
  useRef,
  useTransition,
} from "react";
import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";
import { cn } from "@/lib/utils/cn";

export type TabItem = {
  /** Value in the URL: `?tab=closed`. Lowercase kebab-case. */
  id: string;
  label: string;
  /** Small count after the label, e.g. open requests. */
  count?: number;
  /**
   * The panel. A server page may pass only the selected tab's content (read `searchParams.tab` and fetch that);
   * the other tabs show a loading placeholder until the page re-renders.
   */
  content?: ReactNode;
};

type Props = {
  tabs: TabItem[];
  /** Names the tab list: "Request status". */
  label: string;
  /** Query parameter that holds the selected tab. */
  param?: string;
  /** Selected when the URL has no (or an unknown) value. Kept out of the URL. Defaults to the first tab. */
  defaultTab?: string;
  /** Query parameters to drop when the tab changes, so page 3 of "Open" doesn't become page 3 of "Closed". */
  resetParams?: string[];
  className?: string;
};

// Tabs whose selection lives in the query string (?tab=closed), so every view can be linked and survives a reload
// (frontend-guidelines §3). WAI-ARIA tabs: ← → move and select, Home / End jump to the ends.
export function Tabs(props: Props) {
  const fallback = props.defaultTab ?? props.tabs[0]?.id;
  // useSearchParams needs a Suspense boundary on prerendered pages; until the URL is known, show the default tab.
  return (
    <Suspense fallback={<TabsView {...props} selected={fallback} onSelect={() => {}} pending={false} />}>
      <UrlTabs {...props} />
    </Suspense>
  );
}

function UrlTabs(props: Props) {
  const { tabs, param = "tab", defaultTab, resetParams = ["page"] } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fallback = defaultTab ?? tabs[0]?.id;

  const fromUrl = searchParams.get(param);
  const current = tabs.some((tab) => tab.id === fromUrl) ? (fromUrl as string) : fallback;

  // Selection moves at once; the URL (and any server re-render) catches up in a transition.
  const [selected, setSelected] = useOptimistic(current);
  const [pending, startTransition] = useTransition();

  function select(id: string) {
    if (id === selected) return;
    const next = new URLSearchParams(searchParams.toString());
    if (id === fallback) next.delete(param);
    else next.set(param, id);
    resetParams.forEach((name) => next.delete(name));
    const query = next.toString();

    startTransition(() => {
      setSelected(id);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return <TabsView {...props} selected={selected} onSelect={select} pending={pending} />;
}

type ViewProps = Props & {
  selected: string | undefined;
  onSelect: (id: string) => void;
  pending: boolean;
};

function TabsView({ tabs, label, selected, onSelect, pending, className }: ViewProps) {
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(
    tabs.findIndex((tab) => tab.id === selected),
    0,
  );
  const active = tabs[index];

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    const target =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    tabRefs.current[target]?.focus();
    onSelect(tabs[target].id);
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        // Scrolls sideways on phones when the labels don't fit; the top and side padding keep the focus ring visible.
        className="flex gap-1 overflow-x-auto border-b border-line px-1 pt-1 contain-inline-size md:overflow-visible"
      >
        {tabs.map((tab, i) => {
          const isSelected = i === index;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={`${baseId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-[3px] px-3 font-bold whitespace-nowrap",
                "transition-colors duration-200 ease-out",
                isSelected
                  ? "border-primary text-ink"
                  : "border-transparent text-ink-muted hover:border-line-strong hover:text-ink",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "min-w-6 rounded-pill px-1.5 text-center text-xs leading-5 tabular-nums",
                    isSelected ? "bg-primary text-primary-ink" : "bg-surface-sunken text-ink-muted",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={active ? `${baseId}-tab-${active.id}` : undefined}
        aria-busy={pending || undefined}
        tabIndex={0}
      >
        {active?.content ??
          (pending ? (
            <SkeletonGroup label={`Loading ${active?.label ?? ""}`} className="flex flex-col gap-3">
              <Skeleton className="w-2/3" />
              <Skeleton className="w-1/2" />
              <Skeleton shape="block" className="h-24" />
            </SkeletonGroup>
          ) : null)}
      </div>
    </div>
  );
}
