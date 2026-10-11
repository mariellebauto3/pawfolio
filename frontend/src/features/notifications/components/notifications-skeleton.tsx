import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";

// The Notifications page while it loads (NT-02, NT-03), in the shape of the page: title, tabs, rows.
export function NotificationsSkeleton() {
  return (
    <SkeletonGroup label="Loading your notifications" className="mx-auto flex w-full max-w-narrow flex-col gap-6">
      <span className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="w-96 max-w-full" />
      </span>
      <Skeleton className="h-10 w-80 max-w-full" />
      <div className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} className="flex items-start gap-3 px-4 py-4">
            <Skeleton shape="circle" className="size-10 shrink-0" />
            <span className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="w-1/3" />
              <Skeleton className="w-4/5" />
            </span>
          </span>
        ))}
      </div>
    </SkeletonGroup>
  );
}
