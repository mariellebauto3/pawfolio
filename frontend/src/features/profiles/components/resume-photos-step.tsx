"use client";

import { useState } from "react";
import { Alert } from "@/components/feedback/alert";
import { FileUpload } from "@/components/forms/file-upload";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Photo } from "@/components/ui/photo";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { useToast } from "@/providers/toast-provider";
import type { PetPhoto } from "@/types/pet";
import { reorderPhotos, setCoverPhoto } from "../api/resume";
import { RESUME_LIMITS, movePhoto } from "../schemas/resume-schemas";
import type { OwnPet } from "../types/own-pet";

type Props = {
  pet: OwnPet;
  /** Every change here is saved right away; the wizard gets the resume as the API answered. */
  onChange: (pet: OwnPet) => void;
  /** Opens the Add photo dialog (PR-09). The wizard renders it, outside its own form. */
  onAdd: () => void;
  /** Asks before removing a photo. The wizard renders the confirmation. */
  onRemove: (photo: PetPhoto) => void;
};

const UNKNOWN_PROBLEM = "That didn't go through. Check your connection and try again.";

// PR-04 Photos: three to ten, the first being the profile photo. Add opens the PR-09 dialog; Make profile photo,
// Move and Remove act on one photo; the cover photo is uploaded below. Nothing here waits for Next.
export function ResumePhotosStep({ pet, onChange, onAdd, onRemove }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [coverError, setCoverError] = useState<string | undefined>();
  const [coverKey, setCoverKey] = useState(0);

  const photos = pet.photos;
  const ids = photos.map((photo) => photo.id);
  // The API keeps at least one photo on a Draft and three on a published resume.
  const minimum = pet.status === "draft" ? 1 : RESUME_LIMITS.minPhotos;
  const canRemove = photos.length > minimum;
  const full = photos.length >= RESUME_LIMITS.maxPhotos;

  async function run(action: () => Promise<OwnPet>, done: string) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      onChange(await action());
      toast.show(done);
    } catch (failure) {
      setProblem(isApiError(failure) ? failure.message : UNKNOWN_PROBLEM);
    } finally {
      setBusy(false);
    }
  }

  async function uploadCover(files: File[]) {
    const file = files[0];
    if (!file || busy) return;
    setBusy(true);
    setCoverError(undefined);
    try {
      onChange(await setCoverPhoto(api, file));
      setCoverKey((key) => key + 1);
      toast.show("Cover photo updated.");
    } catch (failure) {
      setCoverError(isApiError(failure) ? (failure.fieldErrors.cover_photo ?? failure.message) : UNKNOWN_PROBLEM);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-ink-muted">
        Add {RESUME_LIMITS.minPhotos} to {RESUME_LIMITS.maxPhotos} clear photos. The first photo is your profile picture.{" "}
        <span className="whitespace-nowrap">
          {photos.length} of {RESUME_LIMITS.maxPhotos} added.
        </span>
      </p>

      {problem && (
        <Alert tone="error" announce>
          {problem}
        </Alert>
      )}

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {photos.map((photo, index) => {
          const name = index === 0 ? "the profile photo" : `photo ${index + 1}`;
          return (
            <li key={photo.id} className="flex flex-col gap-2">
              <Photo
                src={photo.url}
                alt={photo.caption ? `${pet.name}: ${photo.caption}` : `${pet.name}, photo ${index + 1}`}
                sizes="(min-width: 768px) 240px, 50vw"
              />
              <p className="text-sm">
                <span className="font-bold">{index === 0 ? "Profile photo" : `Photo ${index + 1}`}</span>
                {photo.caption && <span className="text-ink-muted"> · {photo.caption}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <IconButton
                  icon="chevron-left"
                  label={`Move ${name} earlier`}
                  disabled={busy || index === 0}
                  onClick={() => run(() => reorderPhotos(api, movePhoto(ids, photo.id, index - 1)), "Photo moved.")}
                />
                <IconButton
                  icon="chevron-right"
                  label={`Move ${name} later`}
                  disabled={busy || index === photos.length - 1}
                  onClick={() => run(() => reorderPhotos(api, movePhoto(ids, photo.id, index + 1)), "Photo moved.")}
                />
                <IconButton
                  icon="trash"
                  label={canRemove ? `Remove ${name}` : `Remove ${name} (a resume keeps at least ${minimum})`}
                  disabled={busy || !canRemove}
                  onClick={() => onRemove(photo)}
                />
              </div>
              {index > 0 && (
                <Button
                  variant="tertiary"
                  size="sm"
                  disabled={busy}
                  className="self-start"
                  onClick={() => run(() => reorderPhotos(api, movePhoto(ids, photo.id, 0)), "Profile photo changed.")}
                >
                  Make profile photo
                </Button>
              )}
            </li>
          );
        })}
        {!full && (
          <li>
            <button
              type="button"
              onClick={onAdd}
              disabled={busy}
              aria-haspopup="dialog"
              className="flex aspect-4/3 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-surface font-bold text-primary transition-colors duration-200 ease-out hover:border-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="upload" className="size-6" />
              Add photo
            </button>
          </li>
        )}
      </ul>
      {!canRemove && photos.length > 0 && (
        <p className="text-sm text-ink-muted">
          {pet.status === "draft"
            ? "A resume keeps at least one photo. Add another before removing this one."
            : `A published resume keeps at least ${RESUME_LIMITS.minPhotos} photos. Add another before removing one.`}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        {pet.cover_photo_url && (
          <Photo ratio="cover" src={pet.cover_photo_url} alt={`${pet.name}'s cover photo`} sizes="(min-width: 768px) 760px, 100vw" />
        )}
        <FileUpload
          key={coverKey}
          label={pet.cover_photo_url ? "Replace the cover photo" : "Cover photo"}
          optional
          accept={["jpg", "png"]}
          hint="A wide photo across the top of your resume. JPG or PNG, up to 5 MB."
          error={coverError}
          onFilesChange={uploadCover}
        />
      </div>

    </>
  );
}
