import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import { Logo } from "./logo";
import { GUEST_NAV } from "./nav-config";

// Visitor top bar (AU-01). On phones the section links move to the footer, leaving the logo, Join now and Sign in.
export function GuestTopBar() {
  return (
    <header className="sticky top-0 z-(--pf-z-sticky) border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-content items-center gap-2 px-gutter md:gap-6">
        <Logo href={ROUTES.landing} />
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex gap-1">
            {GUEST_NAV.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center rounded-pill px-3 text-ink-muted no-underline transition-colors duration-200 ease-out hover:bg-surface-sunken hover:text-ink"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link href={ROUTES.signUp} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
            Join now
          </Link>
          <Link href={ROUTES.signIn} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
