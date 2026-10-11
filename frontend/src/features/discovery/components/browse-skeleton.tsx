import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";

// Browse while it loads (DS-01, DS-02), in the shape of the page: title, filter panel, search row, cards.
export function BrowseSkeleton() {
  return (
    <SkeletonGroup label="Loading Browse" className="flex flex-col gap-6">
      <span className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="w-96 max-w-full" />
      </span>
      <div className="grid items-start gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <Skeleton shape="block" className="hidden h-[32rem] lg:block" />
        <div className="flex flex-col gap-4">
          <Skeleton shape="block" className="h-11" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} shape="block" className="h-80" />
            ))}
          </div>
        </div>
      </div>
    </SkeletonGroup>
  );
}
