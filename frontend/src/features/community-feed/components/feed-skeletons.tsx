import { Skeleton, SkeletonGroup, SkeletonText } from "@/components/feedback/skeleton";

/** One post in the shape of the card: the author row, a few lines, and a photo on every other one. */
function PostSkeleton({ photo = false }: { photo?: boolean }) {
  return (
    <span className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-5">
      <span className="flex items-center gap-3">
        <Skeleton shape="circle" className="size-10" />
        <span className="flex flex-1 flex-col gap-2">
          <Skeleton className="w-40 max-w-full" />
          <Skeleton className="h-3 w-24" />
        </span>
        <Skeleton className="h-5 w-16" />
      </span>
      <SkeletonText lines={photo ? 2 : 3} />
      {photo && <Skeleton shape="block" className="aspect-4/3 w-full" />}
    </span>
  );
}

// The feed while it loads (FD-01, FD-02): the composer and the first posts, in the columns they will arrive in.
export function FeedSkeleton() {
  return (
    <SkeletonGroup label="Loading the feed" className="grid gap-6 lg:grid-cols-[14.5rem_minmax(0,1fr)_18.5rem] lg:items-start">
      <Skeleton shape="block" className="hidden h-80 lg:block" />
      <span className="mx-auto flex w-full max-w-xl flex-col gap-4 lg:max-w-none">
        <Skeleton shape="block" className="h-28" />
        <PostSkeleton photo />
        <PostSkeleton />
      </span>
      <span className="hidden flex-col gap-4 lg:flex">
        <Skeleton shape="block" className="h-56" />
        <Skeleton shape="block" className="h-32" />
      </span>
    </SkeletonGroup>
  );
}

// A post's own page while it loads (FD-05): the post, then the author card beside it.
export function PostPageSkeleton() {
  return (
    <SkeletonGroup label="Loading the post" className="flex flex-col gap-4">
      <Skeleton className="w-28" />
      <span className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <PostSkeleton photo />
        <Skeleton shape="block" className="h-40" />
      </span>
    </SkeletonGroup>
  );
}
