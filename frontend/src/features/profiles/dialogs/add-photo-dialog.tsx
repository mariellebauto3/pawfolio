"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { ChoiceChips } from "@/components/forms/choice-chips";
import { Field } from "@/components/forms/field";
import { FileUpload } from "@/components/forms/file-upload";
import { Input } from "@/components/forms/input";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";
import type { NewPhoto } from "../api/resume";
import { type Crop, NO_CROP, PhotoCropper, cropToFile } from "../components/photo-cropper";
import { RESUME_LIMITS } from "../schemas/resume-schemas";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The cropped photo, for the photos step's draft. Nothing is uploaded until the step is saved. */
  onAdded: (photo: NewPhoto) => void;
};

const UNREADABLE = "We couldn't read that photo. Choose another JPG or PNG.";

// PR-09 Add a photo: choose, crop to the resume's 4:3, caption, and say whether it is the profile photo. The photo
// joins the photos step as a change that isn't saved yet; Next or Save on the step uploads it (BUG-03).
export function AddPhotoDialog(props: Props) {
  // Mounted only while open, so every visit starts empty.
  return props.open ? <AddPhotoDialogContent {...props} /> : null;
}

function AddPhotoDialogContent({ onClose, onAdded }: Props) {
  const [chosen, setChosen] = useState<{ file: File; url: string } | null>(null);
  const [crop, setCrop] = useState<Crop>(NO_CROP);
  const [caption, setCaption] = useState("");
  const [use, setUse] = useState("gallery");
  const [busy, setBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | undefined>();

  // The chosen photo is shown from memory (a blob: address) and released when replaced or when the dialog closes.
  const address = useRef<string | null>(null);
  useEffect(() => () => void (address.current && URL.revokeObjectURL(address.current)), []);

  function choose(files: File[]) {
    if (address.current) URL.revokeObjectURL(address.current);
    const file = files[0];
    address.current = file ? URL.createObjectURL(file) : null;
    setChosen(file && address.current ? { file, url: address.current } : null);
    setCrop(NO_CROP);
    setPhotoError(undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen || busy) return;
    setBusy(true);
    setPhotoError(undefined);

    try {
      const cropped = await cropToFile(chosen.file, crop);
      onAdded({ file: cropped, caption, asProfilePhoto: use === "profile" });
      onClose();
    } catch {
      setBusy(false);
      setPhotoError(UNREADABLE);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Add a photo"
      subtitle="The photo is saved with the step when you press Next or Save."
      dismissible={!busy}
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!chosen} loading={busy} loadingLabel="Preparing the photo">
            Add photo
          </Button>
        </>
      }
    >
      <FileUpload
        label="Photo"
        accept={["jpg", "png"]}
        hint="JPG or PNG, up to 5 MB. Photos are compressed automatically."
        error={photoError}
        onFilesChange={choose}
      />

      {chosen && (
        <div className="grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <PhotoCropper key={chosen.url} src={chosen.url} crop={crop} onChange={setCrop} />
          <div className="flex flex-col gap-5">
            <Field label="Caption" optional>
              <Input
                name="caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={RESUME_LIMITS.caption}
                placeholder="e.g. Beach day with my foster"
                disabled={busy}
              />
            </Field>
            <ChoiceChips
              name="use_as"
              legend="Use as"
              options={[
                { value: "gallery", label: "Gallery photo" },
                { value: "profile", label: "Profile photo" },
              ]}
              value={use}
              onChange={setUse}
              disabled={busy}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
