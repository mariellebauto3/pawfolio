"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Wizard } from "@/components/forms/wizard";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Card } from "@/components/ui/card";
import { ROUTES, resumeEditPath } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import type { PetPhoto } from "@/types/pet";
import { deletePhoto, deleteVetRecord, getOwnPet, publishResume, updateResume } from "../api/resume";
import { ResumePhotosStep } from "../components/resume-photos-step";
import { ResumePublished } from "../components/resume-published";
import { ResumeReviewStep } from "../components/resume-review-step";
import { ResumeAboutStep, ResumeBasicsStep, ResumeHealthFields, ResumeSkillsStep } from "../components/resume-steps";
import { ResumeVetRecords } from "../components/resume-vet-records";
import { AddPhotoDialog } from "../dialogs/add-photo-dialog";
import {
  RESUME_STEPS,
  REVIEW_STEP,
  type ResumeField,
  type ResumeValues,
  resumeFieldErrors,
  resumeStepPayload,
  resumeValuesFrom,
  validateResumeStep,
} from "../schemas/resume-schemas";
import type { OwnPet, VetRecord } from "../types/own-pet";

type Props = {
  pet: OwnPet;
  /** Zero-based step to open, from `?step=`. */
  initialStep: number;
};

const UNKNOWN_PROBLEM = "We couldn't save that. Check your connection and try again.";
const NOT_READY = "Finish the items marked below, then publish.";
const SAVED_TIME = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });

// PR-03…PR-08 and PR-10: the six-step edit resume wizard (FR20, NFR1). Each form step is saved when the pet leaves
// it with Next, or on Save draft, so nothing typed is lost and the review step reads the API's own checklist;
// photos and vet records save as they are added. The status is never sent: Publish asks the API to move a Draft to
// Looking for a Home (FR27).
export function ResumeWizard({ pet: loaded, initialStep }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pet, setPet] = useState(loaded);
  const [values, setValues] = useState<ResumeValues>(() => resumeValuesFrom(loaded));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [step, setStep] = useState(initialStep);
  const [problem, setProblem] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | undefined>();
  const [published, setPublished] = useState(false);
  // The dialogs of the photos and health steps. They have forms of their own, so they are rendered beside the
  // wizard, never inside its form.
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState<PetPhoto | null>(null);
  const [removingRecord, setRemovingRecord] = useState<VetRecord | null>(null);
  const form = useRef<HTMLFormElement | null>(null);
  const focusInvalid = useRef(false);
  const publishedHeading = useRef<HTMLDivElement>(null);

  const draft = pet.status === "draft";
  // What is typed but not saved yet, to warn before the page is left.
  const unsaved = JSON.stringify(values) !== JSON.stringify(resumeValuesFrom(pet));

  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // After a failed check, put focus on the first field with an error so its message is read out.
  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    form.current?.querySelector<HTMLElement>('[role="group"]:not([hidden]) [aria-invalid="true"]')?.focus();
  }, [errors]);

  useEffect(() => {
    if (published) publishedHeading.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [published]);

  function set<F extends ResumeField>(field: F, value: ResumeValues[F]) {
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
    window.history.replaceState(null, "", resumeEditPath(next + 1));
  }

  function showErrors(found: FieldErrors) {
    setErrors(found);
    focusInvalid.current = true;
  }

  /** Checks the step and saves what changed on it. False when something needs fixing. */
  async function saveStep(current: number, element: HTMLFormElement): Promise<boolean> {
    form.current = element;
    setProblem(null);
    const found = validateResumeStep(current, values, !draft);
    if (Object.keys(found).length) {
      showErrors(found);
      return false;
    }

    const body = resumeStepPayload(current, values);
    const unchanged = JSON.stringify(body) === JSON.stringify(resumeStepPayload(current, resumeValuesFrom(pet)));
    if (unchanged) {
      setSavedAt(`Saved at ${SAVED_TIME.format(new Date())}`);
      return true;
    }

    try {
      const saved = await updateResume(api, body);
      setPet(saved);
      setSavedAt(`Saved at ${SAVED_TIME.format(new Date())}`);
      return true;
    } catch (failure) {
      if (isApiError(failure) && failure.kind === "validation") showErrors(resumeFieldErrors(failure.fieldErrors));
      else setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
      return false;
    }
  }

  async function finish() {
    setProblem(null);
    if (!draft) {
      toast.show("Your resume is up to date.");
      router.push(ROUTES.me);
      router.refresh();
      return;
    }
    if (!pet.completeness.is_complete) return setProblem(NOT_READY);

    try {
      setPet(await publishResume(api));
      setPublished(true);
    } catch (failure) {
      if (isApiError(failure) && failure.kind === "validation") {
        // Something changed since the checklist was drawn: read it again so it shows what is missing now.
        setPet(await getOwnPet(api).catch(() => pet));
        return setProblem(NOT_READY);
      }
      setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
    }
  }

  if (published) {
    return (
      <div ref={publishedHeading}>
        <ResumePublished name={pet.name} />
      </div>
    );
  }

  const stepProps = { values, errors, set };
  // A problem that isn't about one field (the API can't be reached, the resume isn't ready) shows on the open step.
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
        onNext={saveStep}
        onFinish={finish}
        onSaveDraft={async (element) => {
          await saveStep(step, element);
        }}
        draftStatus={savedAt}
        saveDraftLabel={draft ? "Save draft" : "Save changes"}
        finishLabel={draft ? "Publish resume" : "Done"}
        steps={[
          { label: RESUME_STEPS[0], content: withProblem(0, <ResumeBasicsStep pet={pet} {...stepProps} />) },
          { label: RESUME_STEPS[1], content: withProblem(1, <ResumePhotosStep pet={pet} onChange={setPet} onAdd={() => setAddingPhoto(true)} onRemove={setRemovingPhoto} />) },
          { label: RESUME_STEPS[2], content: withProblem(2, <ResumeAboutStep {...stepProps} />) },
          { label: RESUME_STEPS[3], content: withProblem(3, <ResumeSkillsStep {...stepProps} />) },
          {
            label: RESUME_STEPS[4],
            content: withProblem(
              4,
              <>
                <ResumeHealthFields {...stepProps} />
                <ResumeVetRecords pet={pet} onChange={setPet} onRemove={setRemovingRecord} />
              </>,
            ),
          },
          { label: RESUME_STEPS[REVIEW_STEP], content: withProblem(REVIEW_STEP, <ResumeReviewStep pet={pet} onGoToStep={openStep} />) },
        ]}
      />

      <AddPhotoDialog
        open={addingPhoto}
        onClose={() => setAddingPhoto(false)}
        onAdded={(next) => {
          setPet(next);
          toast.show("Photo added.");
        }}
      />
      <ConfirmDialog
        open={removingPhoto !== null}
        onClose={() => setRemovingPhoto(null)}
        destructive
        title="Remove this photo?"
        confirmLabel="Remove photo"
        consequences={["The photo is taken off your resume.", "To show it again you would add it again."]}
        onConfirm={async () => {
          if (!removingPhoto) return;
          setPet(await deletePhoto(api, removingPhoto.id));
          toast.show("Photo removed.");
        }}
      />
      <ConfirmDialog
        open={removingRecord !== null}
        onClose={() => setRemovingRecord(null)}
        destructive
        permanent
        title="Remove this vet record?"
        confirmLabel="Remove record"
        consequences={["The file is deleted.", "Humans with an approved request can no longer open it."]}
        onConfirm={async () => {
          if (!removingRecord) return;
          setPet(await deleteVetRecord(api, removingRecord.id));
          toast.show("Vet record removed.");
        }}
      />
    </Card>
  );
}
