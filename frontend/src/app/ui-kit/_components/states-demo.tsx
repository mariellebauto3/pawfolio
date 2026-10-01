"use client";

import { useState } from "react";
import { Banner } from "@/components/feedback/banner";
import { ErrorState } from "@/components/feedback/error-state";
import { Skeleton, SkeletonGroup, SkeletonText } from "@/components/feedback/skeleton";
import { Button } from "@/components/ui/button";

// Dev-only demos for /ui-kit that need state: a dismissible announcement and a retry that loads, then fails again.

export function AnnouncementBannerDemo() {
  const [shown, setShown] = useState(true);

  if (!shown) {
    return (
      <Button size="sm" onClick={() => setShown(true)}>
        Show the announcement again
      </Button>
    );
  }

  return (
    <Banner
      tone="info"
      icon="bell"
      title="Adoption weekend on Oct 10"
      onDismiss={() => setShown(false)}
    >
      Partner shelters in Quezon City host Meet &amp; Greets from 9 AM to 4 PM.
    </Banner>
  );
}

export function RetryDemo() {
  const [loading, setLoading] = useState(false);

  function retry() {
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }

  if (loading) {
    return (
      <SkeletonGroup label="Loading your matches" className="flex flex-col gap-4 py-6">
        <div className="flex items-center gap-3">
          <Skeleton shape="circle" className="size-10" />
          <Skeleton className="w-40" />
        </div>
        <Skeleton shape="block" className="aspect-4/3 w-full" />
        <SkeletonText lines={2} />
      </SkeletonGroup>
    );
  }

  return <ErrorState kind="network" titleAs="h3" onRetry={retry} />;
}
