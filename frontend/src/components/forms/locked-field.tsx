"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-styles";
import { Icon } from "@/components/ui/icon";
import { Field } from "./field";
import { Input } from "./input";

type Props = {
  label: string;
  value: string;
  hint?: string;
  /** Opens the "Request a change" dialog (AC-03). Use this or `requestChangeHref`. */
  onRequestChange?: () => void;
  requestChangeHref?: string;
  className?: string;
};

// A detail an admin verified (pet name, species, breed, age; human name, birthdate). Shown read-only, not disabled,
// so it stays focusable, readable and copyable. Changes go through an admin review (ui-guidelines §4, AC-03).
export function LockedField({
  label,
  value,
  hint = "Checked during verification. An admin reviews any change.",
  onRequestChange,
  requestChangeHref,
  className,
}: Props) {
  const actionLabel = (
    <>
      Request a change<span className="sr-only"> to {label}</span>
    </>
  );

  return (
    <div className={className}>
      <Field
        label={label}
        hint={hint}
        labelSuffix={
          <span className="inline-flex items-center gap-1 rounded-badge border border-line-strong px-1.5 text-xs font-bold text-ink-muted">
            <Icon name="lock" className="size-3.5" />
            Locked
          </span>
        }
      >
        <Input value={value} readOnly />
      </Field>
      {requestChangeHref ? (
        <Link href={requestChangeHref} className={buttonClasses({ variant: "tertiary", size: "sm", className: "-ml-4 mt-1" })}>
          {actionLabel}
        </Link>
      ) : onRequestChange ? (
        <Button variant="tertiary" size="sm" onClick={onRequestChange} className="-ml-4 mt-1">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
