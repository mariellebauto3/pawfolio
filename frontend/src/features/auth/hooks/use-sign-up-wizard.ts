"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ROUTES } from "@/constants/routes";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { useSession } from "@/providers/session-provider";
import { type StepFields, placeFieldErrors } from "../schemas/sign-up-schemas";

const REVIEW_PROBLEM = "Some details need another look. Fix the highlighted fields, then submit again.";
const UNKNOWN_PROBLEM = "We couldn't create your account. Please try again.";

type StringField<V> = { [K in keyof V]: V[K] extends string ? K : never }[keyof V] & string;

type Options<V> = {
  /** The empty form. Must be the same object on every render. */
  initial: V;
  stepFields: StepFields;
  validateStep: (step: number, values: V) => FieldErrors;
  submit: (values: V) => Promise<unknown>;
};

// State for a sign-up wizard (AU-08…AU-17): the typed values, inline errors keyed by API field, and the step. Values
// live in React state only, so nothing personal reaches browser storage or the URL (SEC-FE-04); the price is that a
// reload starts over, which the browser warns about once something is typed.
export function useSignUpWizard<V extends object>({ initial, stepFields, validateStep, submit }: Options<V>) {
  const router = useRouter();
  const session = useSession();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const form = useRef<HTMLFormElement | null>(null);
  const focusInvalid = useRef(false);
  const created = useRef(false);

  const dirty = values !== initial;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!created.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // After a failed check, put focus on the first field with an error so its message is read out.
  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    form.current?.querySelector<HTMLElement>('[role="group"]:not([hidden]) [aria-invalid="true"]')?.focus();
  }, [errors, step]);

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
  function text<K extends StringField<V>>(field: K, errorKey: string = field) {
    return {
      name: field,
      value: values[field] as string,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(field, event.target.value as V[K], errorKey),
      onBlur: () => {
        if ((values[field] as string).trim()) showError(errorKey, validateStep(step, values)[errorKey]);
      },
    };
  }

  function showStepErrors(found: FieldErrors, target: number) {
    setErrors(found);
    setStep(target);
    focusInvalid.current = true;
  }

  function onNext(current: number, element: HTMLFormElement): boolean {
    form.current = element;
    setProblem(null);
    const found = validateStep(current, values);
    if (Object.keys(found).length === 0) return true;
    showStepErrors(found, current);
    return false;
  }

  async function onFinish(element: HTMLFormElement): Promise<void> {
    if (created.current) return;
    form.current = element;

    // Every step again: "Edit" on the review step can leave an earlier step changed without passing through Next.
    for (let index = 0; index < stepFields.length; index++) {
      const found = validateStep(index, values);
      if (Object.keys(found).length) return showStepErrors(found, index);
    }

    setProblem(null);
    try {
      await submit(values);
      created.current = true;
      // The API signs the new account in; it is Pending Verification, so the status screen is its only page (AU-18).
      await session.refresh();
      router.replace(ROUTES.accountStatus);
    } catch (failure) {
      if (!isApiError(failure)) return setProblem(UNKNOWN_PROBLEM);
      if (failure.kind !== "validation") return setProblem(failure.message);
      const placed = placeFieldErrors(stepFields, failure.fieldErrors);
      if (placed.firstStep === null) return setProblem(placed.unplaced[0] ?? UNKNOWN_PROBLEM);
      showStepErrors(placed.errors, placed.firstStep);
      if (placed.firstStep !== stepFields.length - 1) setProblem(REVIEW_PROBLEM);
    }
  }

  return {
    values,
    errors,
    /** A problem that isn't about one field: the server is unreachable, sign-ups are rate limited. */
    problem,
    set,
    text,
    /** Opens a step from the review step's "Edit" buttons. */
    goToStep: setStep,
    wizardProps: { step, onStepChange: setStep, onNext, onFinish },
  };
}
