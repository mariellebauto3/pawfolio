import { Skeleton, SkeletonGroup } from "@/components/feedback/skeleton";

// Invites to Apply while it loads (RQ-02), in the shape of the page: title, count, invite cards.
export function InvitesSkeleton() {
  return (
    <SkeletonGroup label="Loading your invites" className="mx-auto flex w-full max-w-narrow flex-col gap-6">
      <span className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="w-96 max-w-full" />
      </span>
      <div className="flex flex-col gap-4">
        <Skeleton className="w-20" />
        {Array.from({ length: 2 }, (_, index) => (
          <Skeleton key={index} shape="block" className="h-52" />
        ))}
      </div>
    </SkeletonGroup>
  );
}
