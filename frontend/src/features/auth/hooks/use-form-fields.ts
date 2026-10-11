"use client";

import { type ChangeEvent, useEffect, useRef, useState } from "react";
import type { FieldErrors } from "@/lib/api/errors";

type StringField<V> = { [K in keyof V]: V[K] extends string ? K : never }[keyof V] & string;

/** What `text()` hands an Input or Select. */
export type TextFieldProps = {
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur: () => void;
};

/** `text` narrowed to the fields one group of inputs shows, so the group works in any form that has those fields. */
export type TextBinder<F extends string> = (field: F, errorKey?: string) => TextFieldProps;

// The typed values and inline errors of a verification form (the sign-up wizards AU-08…AU-17 and the edit form
// AU-19), with errors keyed by API field. Values live in React state only, so nothing personal reaches browser
// storage or the URL (SEC-FE-04); the price is that a reload starts over, which the browser warns about once
// something is typed.
export function useFormFields<V extends object>(
  /** The form as it opens. Must be the same object on every render. */
  initial: V,
  /** Problems with the fields now on screen, for the check a filled field gets when it is left. */
  validate: (values: V) => FieldErrors,
) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const saved = useRef(false);

  const dirty = values !== initial;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!saved.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function showError(field: string, message: string | undefined) {
    setErrors((previous) => {
      if (previous[field] === message) return previous;
      const next = { ...previous };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  /** Stores a value and clears that field's error. `errorKey` is the API field when it differs from the value's name. */
  function set<K extends keyof V & string>(field: K, value: V[K], errorKey: string = field) {
    setValues((previous) => ({ ...previous, [field]: value }));
    showError(errorKey, undefined);
  }

  /** Props for an Input or Select bound to a text value. Leaving a filled field checks it right away. */
  function text<K extends StringField<V>>(field: K, errorKey: string = field): TextFieldProps {
    return {
      name: field,
      value: values[field] as string,
      onChange: (event) => set(field, event.target.value as V[K], errorKey),
      onBlur: () => {
        if ((values[field] as string).trim()) showError(errorKey, validate(values)[errorKey]);
      },
    };
  }

  return {
    values,
    errors,
    setErrors,
    set,
    text,
    /** Call once the API has taken the form, so leaving the page no longer warns. */
    markSaved: () => {
      saved.current = true;
    },
    /** For event handlers: whether the form was already saved, so a second submit does nothing. */
    isSaved: () => saved.current,
  };
}
