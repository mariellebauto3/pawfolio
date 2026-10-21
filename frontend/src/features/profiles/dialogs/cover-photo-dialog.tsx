"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { FileUpload } from "@/components/forms/file-upload";
import { Modal } from "@/components/overlays/modal";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Whether the step shows a cover photo now, for the title. */
  replacing: boolean;
  /** The chosen photo, for the photos step's draft. Nothing is uploaded until the step is saved. */
  onChosen: (file: File) => void;
};

// PR-04 Cover photo: choose a photo and see it in the cover's wide frame. "Use this photo" puts it on the photos
// step as a change that isn't saved yet; Next or Save on the step uploads it, and Cancel, Escape or the close button
// leave the step as it was (BUG-03).
export function CoverPhotoDialog(props: Props) {
  // Mounted only while open, so every visit starts empty.
  return props.open ? <CoverPhotoDialogContent {...props} /> : null;
}

function CoverPhotoDialogContent({ onClose, replacing, onChosen }: Props) {
  const [chosen, setChosen] = useState<{ file: File; url: string } | null>(null);

  // The chosen photo is shown from memory (a blob: address) and released when replaced or when the dialog closes.
  const address = useRef<string | null>(null);
  useEffect(() => () => void (address.current && URL.revokeObjectURL(address.current)), []);

  function choose(files: File[]) {
    if (address.current) URL.revokeObjectURL(address.current);
    const file = files[0];
    address.current = file ? URL.createObjectURL(file) : null;
    setChosen(file && address.current ? { file, url: address.current } : null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chosen) return;
    onChosen(chosen.file);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={replacing ? "Replace the cover photo" : "Add a cover photo"}
      subtitle="A wide photo across the top of your resume. It's saved with the step when you press Next or Save."
      closeOnBackdrop={false}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!chosen}>
            Use this photo
          </Button>
        </>
      }
    >
      <FileUpload label="Cover photo" accept={["jpg", "png"]} hint="JPG or PNG, up to 5 MB. Wide photos fit best." onFilesChange={choose} />

      {chosen && (
        <figure className="flex flex-col gap-2">
          {/* The cover's own frame, so the pet sees what the top of the resume will show. */}
          <div className="relative aspect-3/1 overflow-hidden rounded-card border border-line bg-surface-sunken md:aspect-5/1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={chosen.url} alt="" className="absolute inset-0 size-full object-cover" />
          </div>
          <figcaption className="text-sm text-ink-muted">Preview: how the top of your resume will look.</figcaption>
        </figure>
      )}
    </Modal>
  );
}
