import type { ReactNode } from "react";
import { GuestTopBar } from "@/components/navigation/guest-top-bar";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/navigation/skip-link";
import { Footer } from "./footer";

// Visitor pages (AU-01…AU-17): guest top bar, the page, footer. Pages set their own width, so the landing page can
// run edge to edge.
export function GuestShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <GuestTopBar />
      <main id={MAIN_CONTENT_ID} className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
    </>
  );
}
