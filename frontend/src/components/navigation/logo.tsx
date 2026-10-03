import { cn } from "@/lib/utils/cn";
import { BrandMark } from "./brand-mark";
import { HomeLink } from "./home-link";

type Props = {
  /** Where the logo leads. Leave out for a logo that isn't a link (account-status bar). */
  href?: string;
  /** Words after "Pawfolio", e.g. "Admin". */
  suffix?: string;
  /** `responsive` shows only the mark on phones, where the top bar needs the room (LoFi mobile). */
  wordmark?: "always" | "responsive";
  /** `bar`: 48 px tall, the smallest that keeps the letters readable. `lg`: 56 px, for roomier places such as the footer. */
  size?: "bar" | "lg";
  className?: string;
};

// The brand mark (a paw whose toes spell FOLIO) and the wordmark. The mark alone is too small to read at bar size, so
// the wordmark stays beside it, or as screen-reader text when `wordmark="responsive"` hides it on phones.
export function Logo({ href, suffix, wordmark = "always", size = "bar", className }: Props) {
  const name = suffix ? `Pawfolio ${suffix}` : "Pawfolio";
  const content = (
    <>
      {/* The FOLIO letters need the height: below about 48 px they blur together on 1x screens. */}
      <BrandMark className={size === "lg" ? "h-14" : "h-12"} />
      <span className={cn("font-display text-xl font-bold whitespace-nowrap", wordmark === "responsive" && "sr-only lg:not-sr-only")}>
        {name}
      </span>
    </>
  );
  const classes = cn("flex min-h-11 shrink-0 items-center gap-2.5 text-ink no-underline", className);

  if (!href) return <span className={classes}>{content}</span>;
  return (
    <HomeLink href={href} className={cn(classes, "rounded-control")}>
      {content}
    </HomeLink>
  );
}
