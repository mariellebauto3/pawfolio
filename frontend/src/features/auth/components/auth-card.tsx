import type { ReactNode, Ref } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  /** A round icon above the title, for confirmation states (AU-05 "Check your email"). */
  icon?: IconName;
  /** Text under the card, e.g. "New to Pawfolio? Join now". */
  footer?: ReactNode;
  /** Lets a screen move focus to the title when its content changes (AU-05 after sending). */
  headingRef?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
};

// The centred card the sign-in and password screens sit in (AU-02…AU-06, LoFi "center-card"). One h1 per screen.
export function AuthCard({ title, description, icon, footer, headingRef, children }: Props) {
  return (
    <div className="flex flex-1 items-start justify-center px-gutter py-10 md:items-center md:py-16">
      <div className="w-full max-w-[28rem]">
        <div className="flex flex-col gap-6 rounded-dialog border border-line bg-surface p-6 md:p-8">
          <div className="flex flex-col gap-2">
            {icon && (
              <span aria-hidden="true" className="mb-2 grid size-14 place-items-center rounded-pill bg-primary-soft text-primary">
                <Icon name={icon} className="size-7" />
              </span>
            )}
            <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-3xl">
              {title}
            </h1>
            {description && <p className="text-ink-muted">{description}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="mt-5 text-center text-sm text-ink-muted">{footer}</div>}
      </div>
    </div>
  );
}
