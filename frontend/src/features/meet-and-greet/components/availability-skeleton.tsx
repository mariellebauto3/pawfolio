import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";

// MG-01 while it loads, in the shape of the page: the title and the button, the slots, then the past meetings.
export function AvailabilitySkeleton() {
  return (
    <SkeletonGroup label="Loading your Meet & Greet slots" className="mx-auto flex w-full max-w-narrow flex-col gap-4">
      <span className="mb-2 flex flex-col gap-3">
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="w-96 max-w-full" />
      </span>
      <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-5">
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton shape="block" className="h-16 w-14" />
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="w-24" />
              <Skeleton className="w-64 max-w-full" />
            </span>
          </div>
        ))}
      </div>
      <Skeleton shape="block" className="h-28" />
    </SkeletonGroup>
  );
}
