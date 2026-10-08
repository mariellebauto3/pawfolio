import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";

// Pets for You / Homes for You while it loads (MT-01, MT-02), in the shape of the page: title, quick filters, cards.
export function MatchesSkeleton() {
  return (
    <SkeletonGroup label="Loading your matches" className="flex flex-col gap-6">
      <span className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="w-96 max-w-full" />
      </span>
      <div className="flex flex-col gap-4">
        <span className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-24 rounded-pill md:h-9" />
          ))}
        </span>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} shape="block" className="h-96" />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}
