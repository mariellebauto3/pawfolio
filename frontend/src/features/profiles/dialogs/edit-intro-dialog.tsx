"use client";

import { type FormEvent, useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { Field } from "@/components/forms/field";
import { FileUpload } from "@/components/forms/file-upload";
import { Input } from "@/components/forms/input";
import { LockedField } from "@/components/forms/locked-field";
import { Textarea } from "@/components/forms/textarea";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { api } from "@/lib/api/client";
import { type FieldErrors, isApiError } from "@/lib/api/errors";
import { updateIntro } from "../api/home-profile";
import { HOME_PROFILE_LIMITS, validateIntro } from "../schemas/home-profile-schemas";
import type { OwnHomeProfile } from "../types/own-home-profile";

type Props = {
  open: boolean;
  onClose: () => void;
  home: OwnHomeProfile;
  /** The Home Profile as the API answered after the save, and whether the profile photo was replaced. */
  onSaved: (home: OwnHomeProfile, changed: { profilePhoto: boolean }) => void;
};

const UNKNOWN_PROBLEM = "We couldn't save your intro. Check your connection and try again.";

// PR-12 Edit intro: the top of the Home Profile. The name was verified by an admin and the city belongs to the
// quiz, so both are shown locked; photos are checked and re-encoded by the API (SEC-FILE-01…05).
export function EditIntroDialog(props: Props) {
  // Mounted only while open, so every visit starts from what is saved.
  return props.open ? <EditIntroDialogContent {...props} /> : null;
}

function EditIntroDialogContent({ onClose, home, onSaved }: Props) {
  const [headline, setHeadline] = useState(home.headline ?? "");
  const [aboutHome, setAboutHome] = useState(home.about_home ?? "");
  const [profilePhoto, setProfilePhoto] = useState<File | undefined>();
  const [coverPhoto, setCoverPhoto] = useState<File | undefined>();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setProblem(null);

    const found = validateIntro({ headline, about_home: aboutHome });
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      onSaved(await updateIntro(api, { headline, aboutHome, profilePhoto, coverPhoto }), { profilePhoto: Boolean(profilePhoto) });
      onClose();
    } catch (failure) {
      setBusy(false);
      if (isApiError(failure) && failure.kind === "validation") return setErrors(failure.fieldErrors);
      setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Edit intro"
      subtitle="The top of your Home Profile: what a pet reads first."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingLabel="Saving your intro">
            Save intro
          </Button>
        </>
      }
    >
      <FileUpload
        label={home.profile_photo_url ? "Replace profile photo" : "Profile photo"}
        optional
        accept={["jpg", "png"]}
        hint="JPG or PNG, up to 5 MB. Shown in a circle."
        error={errors.profile_photo}
        onFilesChange={(files) => setProfilePhoto(files[0])}
      />
      <FileUpload
        label={home.cover_photo_url ? "Replace cover photo" : "Cover photo"}
        optional
        accept={["jpg", "png"]}
        hint="JPG or PNG, up to 5 MB. Wide photos fit best."
        error={errors.cover_photo}
        onFilesChange={(files) => setCoverPhoto(files[0])}
      />

      <LockedField
        label="Display name"
        value={home.full_name}
        hint="Your verified name. An admin reviews any change."
        requestChangeHref={ROUTES.settings}
      />

      <Field label="Headline" optional error={errors.headline} hint="One line under your name, e.g. “Family of three, weekend park people”.">
        <Input
          name="headline"
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          maxLength={HOME_PROFILE_LIMITS.headline}
          autoComplete="off"
          disabled={busy}
        />
      </Field>

      <Field label="About our home" optional error={errors.about_home} hint="Shown publicly. Leave out your address and phone number.">
        <Textarea
          name="about_home"
          rows={4}
          value={aboutHome}
          onChange={(event) => setAboutHome(event.target.value)}
          maxLength={HOME_PROFILE_LIMITS.about_home}
          disabled={busy}
        />
      </Field>

      <LockedField
        label="City shown on profile"
        value={home.city}
        hint="Only your city is public. To change it, edit step 2 of your Home Profile & quiz."
      />

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}
    </Modal>
  );
}
