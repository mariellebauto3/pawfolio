import { Skeleton, SkeletonGroup, SkeletonText } from "@/components/feedback/skeleton";

type Props = {
  /** Read by screen readers: "Loading resume", "Loading Home Profile". */
  label: string;
};

// A resume or a Home Profile while it loads (DS-05, DS-07), in the shape of the page: the cover and name card, two
// sections, and the side column.
export function ProfileSkeleton({ label }: Props) {
  return (
    <SkeletonGroup label={label} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-4 overflow-hidden rounded-card border border-line bg-surface pb-5">
          <Skeleton shape="block" className="aspect-3/1 rounded-none md:aspect-5/1" />
          <div className="flex flex-col gap-3 px-4 md:px-5">
            <Skeleton shape="circle" className="-mt-12 size-24 ring-4 ring-surface" />
            <Skeleton className="h-8 w-48 max-w-full" />
            <Skeleton className="w-72 max-w-full" />
            <Skeleton className="w-56 max-w-full" />
          </div>
        </div>
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 md:p-5">
          <Skeleton className="h-6 w-32" />
          <SkeletonText lines={3} />
        </div>
        <Skeleton shape="block" className="h-48" />
      </div>
      <Skeleton shape="block" className="h-56" />
    </SkeletonGroup>
  );
}
