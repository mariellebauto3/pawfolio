"use client";

import { createContext, useContext } from "react";

// Field and Fieldset share their ids with the control inside them, so labels, hints and errors are wired up
// (label htmlFor, aria-describedby, aria-invalid) without each form repeating it.

export type FieldContextValue = {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
};

export const FieldContext = createContext<FieldContextValue | null>(null);

/** For controls inside a Fieldset (chips, radio cards): the group's state only. The fieldset carries the ids. */
export function useFieldState() {
  const field = useContext(FieldContext);
  return { invalid: field?.invalid ?? false, required: field?.required ?? false, disabled: field?.disabled ?? false };
}

type ControlProps = {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
};

/** Merges a control's own props with the surrounding Field's ids and state. `extraDescribedBy` adds e.g. a counter. */
export function useFieldControl(props: ControlProps, extraDescribedBy?: string) {
  const field = useContext(FieldContext);
  const describedBy = [props["aria-describedby"], field?.describedBy, extraDescribedBy].filter(Boolean).join(" ");
  const invalid = props["aria-invalid"] ?? (field?.invalid || undefined);

  return {
    id: props.id ?? field?.controlId,
    required: props.required ?? (field?.required || undefined),
    disabled: props.disabled ?? (field?.disabled || undefined),
    "aria-describedby": describedBy || undefined,
    "aria-invalid": invalid,
  };
}
