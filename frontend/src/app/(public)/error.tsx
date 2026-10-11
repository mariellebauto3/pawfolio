"use client";

import { RouteError } from "@/components/feedback/route-error";

export default function PublicError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="px-gutter py-12">
      <RouteError {...props} />
    </div>
  );
}
