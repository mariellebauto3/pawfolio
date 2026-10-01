import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

type Props = {
  hintId: string;
  errorId: string;
  hint?: ReactNode;
  error?: ReactNode;
};

// Error then helper text, under the control. The error region is always mounted with aria-live so a message that
// appears after submit is announced; colour is never the only signal (icon + text).
export function FieldMessages({ hintId, errorId, hint, error }: Props) {
  return (
    <>
      {/* Empty: taken out of the flow so it adds no gap, but stays in the tree so new errors are announced. */}
      <div aria-live="polite" className="empty:absolute">
        {error && (
          <p id={errorId} className="flex items-start gap-1.5 text-sm font-bold text-danger">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
    </>
  );
}
