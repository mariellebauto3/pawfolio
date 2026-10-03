import Link from "next/link";
import { buttonClasses } from "@/components/ui/button-styles";
import { ROUTES } from "@/constants/routes";
import { GuestMenu } from "./guest-menu";
import { HomeLink } from "./home-link";
import { Logo } from "./logo";
import { GUEST_NAV } from "./nav-config";

const NAV_LINK =
  "flex min-h-11 items-center rounded-pill px-3 text-ink-muted no-underline transition-colors duration-200 ease-out hover:bg-surface-sunken hover:text-ink";

// Visitor top bar (AU-01). From md up it has three columns: logo left, section links centred on the bar, Join now and
// Sign in right; the two outer columns share the leftover space equally, so the links stay centred whatever their
// widths. On phones the bar holds only the logo and a menu button; the links and both actions are in its drawer
// (GuestMenu), and the section links are also in the footer.
export function GuestTopBar() {
  return (
    <header className="sticky top-0 z-(--pf-z-sticky) border-b border-line bg-surface">
      <div className="mx-auto flex h-16 max-w-content items-center gap-2 px-gutter md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6">
        <Logo href={ROUTES.landing} />
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex gap-1">
            {GUEST_NAV.map((link) => {
              const Anchor = link.href === ROUTES.landing ? HomeLink : Link;
              return (
                <li key={link.href}>
                  <Anchor href={link.href} className={NAV_LINK}>
                    {link.label}
                  </Anchor>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex md:justify-self-end">
          <Link href={ROUTES.signUp} className={buttonClasses({ variant: "tertiary", size: "sm" })}>
            Join now
          </Link>
          <Link href={ROUTES.signIn} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Sign in
          </Link>
        </div>
        <GuestMenu className="ml-auto md:hidden" />
      </div>
    </header>
  );
}
