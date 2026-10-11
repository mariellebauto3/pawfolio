import { cn } from "@/lib/utils/cn";

// Kept apart from button.tsx (a client component) so server components can style a <Link> as a button:
// <Link href="/matches" className={buttonClasses({ variant: "secondary" })}>See Pets for You</Link>

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill font-bold whitespace-nowrap select-none " +
  "transition-colors duration-200 ease-out disabled:cursor-not-allowed aria-[busy=true]:cursor-progress";

// One filled primary per area; secondary is outlined; tertiary is text only (ui-guidelines §2).
// Destructive is filled red and belongs on the confirm button of a confirmation dialog, never on the page itself.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-ink hover:bg-primary-hover disabled:bg-surface-sunken disabled:text-ink-muted",
  secondary:
    "border-[1.5px] border-primary bg-surface text-primary hover:bg-primary-soft " +
    "disabled:border-line disabled:bg-surface disabled:text-ink-muted",
  tertiary: "text-primary hover:bg-primary-soft hover:text-primary-soft-ink disabled:bg-transparent disabled:text-ink-muted",
  destructive:
    "bg-danger text-danger-ink hover:bg-danger-hover disabled:bg-surface-sunken disabled:text-ink-muted",
};

// Small buttons stay 44 px tall on phones (touch target) and shrink to 36 px from md up.
const SIZES: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-base",
  sm: "min-h-11 px-4 text-sm md:min-h-9",
};

type Options = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
};

export function buttonClasses({ variant = "secondary", size = "md", block, className }: Options = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], block && "w-full", className);
}
