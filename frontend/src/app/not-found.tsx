import type { Metadata } from "next";
import { PageNotFound } from "@/components/feedback/page-not-found";
import { SessionShell } from "@/components/layout/session-shell";

export const metadata: Metadata = { title: "Page not found" };

// GN-02 for any URL no route matches, inside the shell of whoever is signed in.
export default function NotFound() {
  return (
    <SessionShell>
      <PageNotFound />
    </SessionShell>
  );
}
