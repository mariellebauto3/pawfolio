import { Skeleton, SkeletonGroup, SkeletonText } from "@/components/feedback/skeleton";

// The pet's request screens while they load, each in the shape of its page so nothing jumps when it arrives.

/** RQ-03: the title, the recipient card and the form. */
export function ApplySkeleton() {
  return (
    <SkeletonGroup label="Loading the request form" className="mx-auto flex w-full max-w-narrow flex-col gap-4">
      <Skeleton className="w-56 max-w-full" />
      <span className="mb-2 flex flex-col gap-3">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="w-96 max-w-full" />
      </span>
      <Skeleton shape="block" className="h-24" />
      <Skeleton shape="block" className="h-96" />
    </SkeletonGroup>
  );
}

/** RQ-07, RQ-08: the title, the tabs and a few rows. */
export function RequestsSkeleton() {
  return (
    <SkeletonGroup label="Loading your requests" className="mx-auto flex w-full max-w-narrow flex-col gap-6">
      <span className="flex flex-col gap-3">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="w-56 max-w-full" />
      </span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11 w-48" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} shape="block" className="h-24" />
        ))}
      </div>
    </SkeletonGroup>
  );
}

/** RQ-14…RQ-17: the header card, then the letter beside the status panel. */
export function RequestDetailSkeleton() {
  return (
    <SkeletonGroup label="Loading the request" className="flex flex-col gap-4">
      <Skeleton className="w-32" />
      <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-5">
        <div className="flex items-center gap-3">
          <Skeleton shape="circle" className="size-14" />
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="w-56 max-w-full" />
          </span>
        </div>
        <Skeleton className="h-1.5 w-full" />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton shape="block" className="h-48 lg:col-start-2" />
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-5 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-6 w-40" />
          <SkeletonText lines={4} />
        </div>
      </div>
    </SkeletonGroup>
  );
}
