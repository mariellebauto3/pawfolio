"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { onApiWrite } from "@/lib/api/client";
import { createPageRefresher } from "@/lib/utils/page-refresher";

// Mounted once in the root layout. Whatever a screen writes through `api`, the pages kept for quick navigation
// are dropped and the open one is rendered again, so no screen has to remember which other pages its write
// changes (src/lib/utils/page-refresher.ts). It only decides how fresh a page is: the API still authorizes
// every request itself (SEC-FE-05).
export function PageCacheSync() {
  const router = useRouter();

  useEffect(() => {
    const refresher = createPageRefresher(() => router.refresh());
    const stopListening = onApiWrite(refresher.noteWrite);
    return () => {
      stopListening();
      refresher.stop();
    };
  }, [router]);

  return null;
}
