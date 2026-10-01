import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type Props = {
  steps: string[];
  /** Zero-based index of the step the user is on. */
  current: number;
  className?: string;
};

// Progress through a wizard (NFR1). Bars fill up to the current step. On phones only the bars show; the wizard's
// "Step X of N" heading names the step. Screen readers always hear every step and its state.
export function Stepper({ steps, current, className }: Props) {
  return (
    <ol aria-label="Progress" className={cn("flex gap-1.5", className)}>
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li
            key={step}
            aria-current={state === "current" ? "step" : undefined}
            className="flex min-w-0 flex-1 flex-col gap-2"
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 rounded-pill transition-colors duration-300 ease-out",
                state === "upcoming" ? "bg-line" : "bg-primary",
              )}
            />
            <span
              className={cn(
                "sr-only text-xs md:not-sr-only md:flex md:items-center md:gap-1",
                state === "current" ? "font-bold text-ink" : "text-ink-muted",
              )}
            >
              {state === "done" && <Icon name="check" strokeWidth={2.5} className="size-3.5 shrink-0 text-primary" />}
              <span className="truncate">{step}</span>
              <span className="sr-only">
                {state === "done" ? ", completed" : state === "current" ? ", current step" : ", not started"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
