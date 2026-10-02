import Link from "next/link";
import { cn } from "@/lib/utils/cn";

type Props = {
  /** Where the logo leads. Leave out for a logo that isn't a link (account-status bar). */
  href?: string;
  /** Words after "Pawfolio", e.g. "Admin". */
  suffix?: string;
  /** `responsive` shows only the mark on phones, where the top bar needs the room (LoFi mobile). */
  wordmark?: "always" | "responsive";
  className?: string;
};

// The brand mark is a placeholder "P" tile until a real one exists (docs/design/hifi/README.md, "Not in scope yet").
export function Logo({ href, suffix, wordmark = "always", className }: Props) {
  const name = suffix ? `Pawfolio ${suffix}` : "Pawfolio";
  const content = (
    <>
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-control bg-accent font-display text-lg font-bold text-accent-ink"
      >
        P
      </span>
      <span className={cn("font-display text-xl font-bold whitespace-nowrap", wordmark === "responsive" && "sr-only lg:not-sr-only")}>
        {name}
      </span>
    </>
  );
  const classes = cn("flex min-h-11 shrink-0 items-center gap-2.5 text-ink no-underline", className);

  if (!href) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} className={cn(classes, "rounded-control")}>
      {content}
    </Link>
  );
}
