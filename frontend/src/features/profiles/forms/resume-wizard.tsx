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
import { getOwnPet, publishResume, updateResume } from "../api/resume";
import { ResumePhotosStep } from "../components/resume-photos-step";
import { ResumePublished } from "../components/resume-published";
import { ResumeReviewStep } from "../components/resume-review-step";
import { ResumeAboutStep, ResumeBasicsStep, ResumeHealthFields, ResumeSkillsStep } from "../components/resume-steps";
import { ResumeVetRecords } from "../components/resume-vet-records";
import { AddPhotoDialog } from "../dialogs/add-photo-dialog";
import { CoverPhotoDialog } from "../dialogs/cover-photo-dialog";
import { type DraftSaveResult, type PhotoSlot, usePhotoDraft } from "../hooks/use-photo-draft";
import { type VetRecordSlot, useVetRecordDraft } from "../hooks/use-vet-record-draft";
import {
  PHOTOS_STEP,
  REQUIREMENT_STEP,
  RESUME_STEPS,
  REVIEW_STEP,
  type ResumeField,
  type ResumeValues,
  resumeFieldErrors,
  resumeStepPayload,
  resumeValuesFrom,
  validateResumeStep,
} from "../schemas/resume-schemas";
import type { OwnPet } from "../types/own-pet";

type Props = {
  pet: OwnPet;
  /** Zero-based step to open, from `?step=`. */
  initialStep: number;
};

const UNKNOWN_PROBLEM = "We couldn't save that. Check your connection and try again.";
const NOT_READY = "Finish the items marked below, then publish.";
const SAVED_TIME = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });
const HEALTH_STEP = REQUIREMENT_STEP.health;

/** Why a photo or vet record save stopped part way. What was sent stays sent; the rest stays marked "Not saved yet". */
function partialSaveProblem(failure: unknown): string {
  const reason = isApiError(failure) ? (Object.values(failure.fieldErrors)[0] ?? failure.message) : UNKNOWN_PROBLEM;
  return `Not everything was saved. ${reason} What's marked "Not saved yet" is still waiting: press Save to try again, or remove it.`;
}

// PR-03…PR-08 and PR-10: the six-step edit resume wizard (FR20, NFR1). Each step is saved when the pet leaves it with
// Next, or on Save draft, and only then: typed answers, photos, the cover photo and vet records alike (BUG-03), so
// Back, Discard changes or leaving the page keep the resume as it was, and the review step reads the API's own
// checklist. The status is never sent: Publish asks the API to move a Draft to Looking for a Home (FR27).
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
  // The photos and vet records the pet changed on their steps, sent with that step's Next or Save.
  const photos = usePhotoDraft(pet);
  const records = useVetRecordDraft(pet);
  // The dialogs of the photos and health steps. They have forms of their own, so they are rendered beside the
  // wizard, never inside its form.
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [changingCover, setChangingCover] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState<PhotoSlot | null>(null);
  const [removingRecord, setRemovingRecord] = useState<VetRecordSlot | null>(null);
  const form = useRef<HTMLFormElement | null>(null);
  const focusInvalid = useRef(false);
  const publishedHeading = useRef<HTMLDivElement>(null);

  const draft = pet.status === "draft";
  // What is changed but not saved yet, to warn before the page is left.
  const unsaved = JSON.stringify(values) !== JSON.stringify(resumeValuesFrom(pet)) || photos.changed || records.changed;

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

    let latest = pet;
    const body = resumeStepPayload(current, values);
    const unchanged = JSON.stringify(body) === JSON.stringify(resumeStepPayload(current, resumeValuesFrom(pet)));
    if (!unchanged) {
      try {
        latest = await updateResume(api, body);
        setPet(latest);
      } catch (failure) {
        if (isApiError(failure) && failure.kind === "validation") showErrors(resumeFieldErrors(failure.fieldErrors));
        else setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
        return false;
      }
    }

    // The files of the step go after its typed answers, each upload answered with the whole resume.
    const files = current === PHOTOS_STEP ? photos : current === HEALTH_STEP ? records : null;
    if (files?.changed) {
      const result: DraftSaveResult = await files.save(latest);
      setPet(result.pet);
      if (result.failure) {
        setProblem(partialSaveProblem(result.failure));
        return false;
      }
    }

    setSavedAt(`Saved at ${SAVED_TIME.format(new Date())}`);
    return true;
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
          {
            label: RESUME_STEPS[PHOTOS_STEP],
            content: withProblem(
              PHOTOS_STEP,
              <ResumePhotosStep
                pet={pet}
                draft={photos}
                onAdd={() => setAddingPhoto(true)}
                // A photo chosen here and not saved yet goes without asking; one on the resume is asked about.
                onRemove={(slot) => (slot.photo ? setRemovingPhoto(slot) : photos.remove(slot.key))}
                onChangeCover={() => setChangingCover(true)}
              />,
            ),
          },
          { label: RESUME_STEPS[2], content: withProblem(2, <ResumeAboutStep {...stepProps} />) },
          { label: RESUME_STEPS[3], content: withProblem(3, <ResumeSkillsStep {...stepProps} />) },
          {
            label: RESUME_STEPS[HEALTH_STEP],
            content: withProblem(
              HEALTH_STEP,
              <>
                <ResumeHealthFields {...stepProps} />
                <ResumeVetRecords
                  draft={records}
                  onRemove={(slot) => (slot.record ? setRemovingRecord(slot) : records.remove(slot.key))}
                />
              </>,
            ),
          },
          { label: RESUME_STEPS[REVIEW_STEP], content: withProblem(REVIEW_STEP, <ResumeReviewStep pet={pet} onGoToStep={openStep} />) },
        ]}
      />

      <AddPhotoDialog open={addingPhoto} onClose={() => setAddingPhoto(false)} onAdded={photos.add} />
      <CoverPhotoDialog
        open={changingCover}
        onClose={() => setChangingCover(false)}
        replacing={Boolean(photos.cover ?? pet.cover_photo_url)}
        onChosen={photos.chooseCover}
      />
      <ConfirmDialog
        open={removingPhoto !== null}
        onClose={() => setRemovingPhoto(null)}
        destructive
        title="Remove this photo?"
        confirmLabel="Remove photo"
        consequences={[
          "The photo comes off your resume when you save this step.",
          "Until then, Discard changes brings it back.",
        ]}
        onConfirm={() => {
          if (removingPhoto) photos.remove(removingPhoto.key);
        }}
      />
      <ConfirmDialog
        open={removingRecord !== null}
        onClose={() => setRemovingRecord(null)}
        destructive
        title="Remove this vet record?"
        confirmLabel="Remove record"
        consequences={[
          "The file is deleted when you save this step, and that can't be undone.",
          "After that, humans with an approved request can no longer open it.",
          "Until then, Discard record changes brings it back.",
        ]}
        onConfirm={() => {
          if (removingRecord) records.remove(removingRecord.key);
        }}
      />
    </Card>
  );
}
