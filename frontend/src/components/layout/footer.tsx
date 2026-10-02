import Link from "next/link";
import { Logo } from "@/components/navigation/logo";
import { GUEST_NAV } from "@/components/navigation/nav-config";
import { ROUTES } from "@/constants/routes";

// Guest footer (AU-01). The LoFi also lists About, Community guidelines, Privacy and Terms: add them here when their
// pages exist, rather than linking to a page that isn't there.
export function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-content flex-col gap-4 px-gutter py-8 md:flex-row md:items-center md:gap-8">
        <Logo href={ROUTES.landing} />
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-2 md:gap-x-4">
            {GUEST_NAV.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex min-h-11 items-center px-1 text-sm text-ink-muted no-underline hover:text-ink hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-ink-muted md:ml-auto">© {new Date().getFullYear()} Pawfolio</p>
      </div>
    </footer>
  );
}
