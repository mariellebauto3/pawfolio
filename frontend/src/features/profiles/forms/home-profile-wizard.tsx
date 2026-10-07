"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Wizard } from "@/components/forms/wizard";
import { Card } from "@/components/ui/card";
import { homeProfileEditPath } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { completeQuiz, getMatchCount, saveQuizDraft, saveQuizStep } from "../api/home-profile";
import { HomeProfileSaved } from "../components/home-profile-saved";
import { QuizReviewStep } from "../components/quiz-review-step";
import { QuizExperienceStep, QuizHomeStep, QuizHouseholdStep, QuizLifestyleStep, QuizPreferencesStep } from "../components/quiz-steps";
import {
  QUIZ_REVIEW_STEP,
  QUIZ_STEPS,
  type QuizField,
  type QuizValues,
  quizDraftPayload,
  quizFieldErrors,
  quizStepPayload,
  quizStepsDone,
  quizValuesFrom,
  sameAnswers,
  validateQuizStep,
} from "../schemas/home-profile-schemas";
import type { OwnHomeProfile } from "../types/own-home-profile";

type Props = {
  home: OwnHomeProfile;
  /** Zero-based step to open, from `?step=`. */
  initialStep: number;
};

const UNKNOWN_PROBLEM = "We couldn't save that. Check your connection and try again.";
const NOT_READY = "Answer the steps marked above, then save.";
const SAVED_TIME = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });

// PR-14…PR-20: the six-step Home Profile & lifestyle quiz (FR3, NFR1). A step is saved when the human leaves it
// with Next, which needs every answer the match uses, or on Save draft, which keeps whatever is answered so far.
// The review step reads what the API holds. The API marks the quiz as finished once every answer the match uses is
// in, usually with step 5; the last button makes sure of it and shows what was saved. Open to Adopt is a separate
// switch on the screen after it (FR4).
export function HomeProfileWizard({ home: loaded, initialStep }: Props) {
  const [home, setHome] = useState(loaded);
  const [values, setValues] = useState<QuizValues>(() => quizValuesFrom(loaded));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [step, setStep] = useState(initialStep);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [matches, setMatches] = useState<number | null>(null);
  const form = useRef<HTMLFormElement | null>(null);
  const focusInvalid = useRef(false);
  const savedHeading = useRef<HTMLDivElement>(null);

  const finished = home.has_completed_quiz;
  // What is answered but not saved yet, to warn before the page is left.
  const unsaved = !saved && !sameAnswers(values, quizValuesFrom(home));

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // After a failed check, put focus on the first question with an error so its message is read out.
  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    // A text field carries aria-invalid; a group of chips is found by the error written under it.
    form.current
      ?.querySelector<HTMLElement>('[role="group"]:not([hidden]) :is([aria-invalid="true"], fieldset:has([id$="-error"]) input)')
      ?.focus();
  }, [errors]);

  useEffect(() => {
    if (saved) savedHeading.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [saved]);

  function set<F extends QuizField>(field: F, value: QuizValues[F]) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function openStep(next: number) {
    setStep(next);
    setProblem(null);
    // The step lives in the URL (?step=3), so a reload or a shared link opens the same one.
    window.history.replaceState(null, "", homeProfileEditPath(next + 1));
  }

  function showErrors(found: FieldErrors) {
    setErrors(found);
    focusInvalid.current = true;
  }

  /** Checks the step and saves what changed on it. False when something needs fixing. */
  async function saveStep(current: number, element: HTMLFormElement, leaving: boolean): Promise<boolean> {
    form.current = element;
    setProblem(null);
    // A finished quiz stays finished: every answer the match uses has to stay in place.
    const strict = leaving || finished;
    const found = validateQuizStep(current, values, strict);
    if (Object.keys(found).length) {
      showErrors(found);
      return false;
    }
    // A draft may leave open what Next asked for a moment ago, so messages from an earlier check don't linger.
    setErrors({});

    const payload = strict ? quizStepPayload : quizDraftPayload;
    const body = payload(current, values);
    const unchanged = sameAnswers(body, payload(current, quizValuesFrom(home)));
    if (unchanged || current === QUIZ_REVIEW_STEP) {
      setSavedAt(`Saved at ${SAVED_TIME.format(new Date())}`);
      return true;
    }

    try {
      setHome(strict ? await saveQuizStep(api, current + 1, body) : await saveQuizDraft(api, body));
      setSavedAt(`Saved at ${SAVED_TIME.format(new Date())}`);
      return true;
    } catch (failure) {
      if (isApiError(failure) && failure.kind === "validation") showErrors(quizFieldErrors(failure.fieldErrors));
      else setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
      return false;
    }
  }

  async function finish() {
    setProblem(null);
    // The API doesn't check the five steps itself when the quiz is marked finished, so this check comes first.
    if (quizStepsDone(home).includes(false)) return setProblem(NOT_READY);

    try {
      if (!finished) setHome(await completeQuiz(api));
      // The count is an extra: the screen says the profile is saved with or without it.
      setMatches(await getMatchCount(api).catch(() => null));
      setSaved(true);
    } catch (failure) {
      setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
    }
  }

  if (saved) {
    return (
      <div ref={savedHeading}>
        <HomeProfileSaved home={home} onChange={setHome} matches={matches} />
      </div>
    );
  }

  const stepProps = { values, errors, set };
  // A problem that isn't about one question (the API can't be reached, a step is still open) shows on the open step.
  const withProblem = (index: number, content: ReactNode) => (
    <>
      {content}
      {problem && step === index && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </>
  );

  return (
    <Card>
      <Wizard
        step={step}
        onStepChange={openStep}
        onNext={(current, element) => saveStep(current, element, true)}
        onFinish={finish}
        onSaveDraft={async (element) => {
          await saveStep(step, element, false);
        }}
        draftStatus={savedAt}
        saveDraftLabel={finished ? "Save changes" : "Save draft"}
        finishLabel="Save Home Profile"
        steps={[
          { label: QUIZ_STEPS[0], content: withProblem(0, <QuizHouseholdStep {...stepProps} />) },
          { label: QUIZ_STEPS[1], content: withProblem(1, <QuizHomeStep {...stepProps} />) },
          { label: QUIZ_STEPS[2], content: withProblem(2, <QuizLifestyleStep {...stepProps} />) },
          { label: QUIZ_STEPS[3], content: withProblem(3, <QuizExperienceStep {...stepProps} />) },
          { label: QUIZ_STEPS[4], content: withProblem(4, <QuizPreferencesStep {...stepProps} />) },
          { label: QUIZ_STEPS[QUIZ_REVIEW_STEP], content: withProblem(QUIZ_REVIEW_STEP, <QuizReviewStep home={home} onGoToStep={openStep} />) },
        ]}
      />
    </Card>
  );
}
