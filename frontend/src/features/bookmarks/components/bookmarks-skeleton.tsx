import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";

// Bookmarks while it loads (BM-01, BM-02), in the shape of the page: title, count, cards.
export function BookmarksSkeleton() {
  return (
    <SkeletonGroup label="Loading your bookmarks" className="flex flex-col gap-6">
      <span className="flex flex-col gap-3">
        <Skeleton className="h-8 w-44 max-w-full" />
        <Skeleton className="w-64 max-w-full" />
      </span>
      <div className="flex flex-col gap-4">
        <Skeleton className="w-28" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} shape="block" className="h-80" />
          ))}
        </div>
      </div>
    </SkeletonGroup>
  );
}
