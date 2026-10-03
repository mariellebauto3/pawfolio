"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/overlays/drawer";
import { buttonClasses } from "@/components/ui/button-styles";
import { IconButton } from "@/components/ui/icon-button";
import { ROUTES } from "@/constants/routes";
import { HomeLink } from "./home-link";
import { GUEST_NAV } from "./nav-config";

const MENU_LINK =
  "flex min-h-12 items-center rounded-control px-3 text-lg text-ink no-underline transition-colors duration-200 ease-out hover:bg-surface-sunken";

type Props = {
  className?: string;
};

// The visitor menu on phones (AU-01…AU-17): one menu button in the top bar opens a drawer with the section links and
// the two account actions, so the bar holds only the logo and the button. Members keep their bottom tab bar instead
// (ui-guidelines §1: no hamburger for screens used all day). Choosing anything closes the drawer.
export function GuestMenu({ className }: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className={className}>
      <IconButton
        icon="menu"
        label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      />
      <Drawer open={open} onClose={close} title="Menu">
        <nav aria-label="Main">
          <ul className="flex flex-col gap-1">
            {GUEST_NAV.map((link) => (
              <li key={link.href}>
                {link.href === ROUTES.landing ? (
                  <HomeLink href={link.href} onNavigate={close} className={MENU_LINK}>
                    {link.label}
                  </HomeLink>
                ) : (
                  <Link href={link.href} onClick={close} className={MENU_LINK}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6">
          <Link href={ROUTES.signUp} onClick={close} className={buttonClasses({ variant: "primary", block: true })}>
            Join now
          </Link>
          <Link href={ROUTES.signIn} onClick={close} className={buttonClasses({ variant: "secondary", block: true })}>
            Sign in
          </Link>
        </div>
      </Drawer>
    </div>
  );
}
