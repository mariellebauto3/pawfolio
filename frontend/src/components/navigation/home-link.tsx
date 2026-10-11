"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

type Props = {
  href: string;
  className?: string;
  /** Runs on every click, e.g. to close the phone menu the link sits in. */
  onNavigate?: () => void;
  children: ReactNode;
};

// The logo's link, and the visitor nav's Home. From another page it navigates as usual. On the page it points to,
// where Next.js would do nothing (same URL), it scrolls back to the top, e.g. the landing page's hero, and clears a
// section hash such as #faq left by the nav links. Smooth unless reduced motion is on.
export function HomeLink({ href, className, onNavigate, children }: Props) {
  const pathname = usePathname();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    onNavigate?.();
    if (pathname !== href || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    if (window.location.hash) window.history.replaceState(window.history.state, "", href);
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
