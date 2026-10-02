"use client";

import { RouteError } from "@/components/feedback/route-error";

// Last-resort boundary for the landing page and for a shell that failed to render. No shell here, since the shell
// itself may be what broke; route groups have their own error.tsx inside their shell.
export default function AppError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-gutter py-12">
      <RouteError {...props} />
    </div>
  );
}
