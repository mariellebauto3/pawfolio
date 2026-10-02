"use client";

import { RouteError } from "@/components/feedback/route-error";

export default function AccountStatusError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError {...props} />;
}
