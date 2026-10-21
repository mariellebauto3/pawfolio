"use client";

import { Alert } from "@/components/feedback/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Photo } from "@/components/ui/photo";
import type { PhotoSlot, usePhotoDraft } from "../hooks/use-photo-draft";
import { RESUME_LIMITS } from "../schemas/resume-schemas";
import type { OwnPet } from "../types/own-pet";

type Props = {
  pet: OwnPet;
  /** The step's unsaved changes. The wizard holds them and sends them on Next or Save. */
  draft: ReturnType<typeof usePhotoDraft>;
  /** Opens the Add photo dialog (PR-09). The wizard renders it, outside its own form. */
  onAdd: () => void;
  /** Takes a photo off the step; the wizard asks first when the photo is on the resume. */
  onRemove: (slot: PhotoSlot) => void;
  /** Opens the cover photo dialog. The wizard renders it, outside its own form. */
  onChangeCover: () => void;
};

// PR-04 Photos: three to ten, the first being the profile photo. Add opens the PR-09 dialog; Make profile photo,
// Move and Remove act on one photo; the cover photo has a dialog of its own. Every change here is a draft until the
// pet presses Next or Save, like the typed steps (BUG-03).
export function ResumePhotosStep({ pet, draft, onAdd, onRemove, onChangeCover }: Props) {
  const { slots, cover, changed, saving } = draft;
  // The API keeps at least one photo on a Draft and three on a published resume.
  const minimum = pet.status === "draft" ? 1 : RESUME_LIMITS.minPhotos;
  const canRemove = slots.length > minimum;
  const full = slots.length >= RESUME_LIMITS.maxPhotos;
  const coverUrl = cover?.url ?? pet.cover_photo_url;

  return (
    <>
      <p className="text-ink-muted">
        Add {RESUME_LIMITS.minPhotos} to {RESUME_LIMITS.maxPhotos} clear photos. The first photo is your profile picture.{" "}
        <span className="whitespace-nowrap">
          {slots.length} of {RESUME_LIMITS.maxPhotos} added.
        </span>{" "}
        Changes here are saved when you press Next or Save.
      </p>

      {changed && (
        <Alert
          action={
            <Button variant="tertiary" size="sm" disabled={saving} onClick={draft.discard}>
              Discard changes
            </Button>
          }
        >
          Your photo changes aren&apos;t saved yet. Press Next or Save to keep them; leaving this page drops them.
        </Alert>
      )}

      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {slots.map((slot, index) => {
          const name = index === 0 ? "the profile photo" : `photo ${index + 1}`;
          return (
            <li key={slot.key} className="flex flex-col gap-2">
              <div className="relative">
                <Photo
                  src={slot.url}
                  alt={slot.caption ? `${pet.name}: ${slot.caption}` : `${pet.name}, photo ${index + 1}`}
                  sizes="(min-width: 768px) 240px, 50vw"
                />
                {slot.file && (
                  <Badge tone="progress" className="absolute top-2 left-2">
                    Not saved yet
                  </Badge>
                )}
              </div>
              <p className="text-sm">
                <span className="font-bold">{index === 0 ? "Profile photo" : `Photo ${index + 1}`}</span>
                {slot.caption && <span className="text-ink-muted"> · {slot.caption}</span>}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <IconButton
                  icon="chevron-left"
                  label={`Move ${name} earlier`}
                  disabled={saving || index === 0}
                  onClick={() => draft.move(slot.key, index - 1)}
                />
                <IconButton
                  icon="chevron-right"
                  label={`Move ${name} later`}
                  disabled={saving || index === slots.length - 1}
                  onClick={() => draft.move(slot.key, index + 1)}
                />
                <IconButton
                  icon="trash"
                  label={canRemove ? `Remove ${name}` : `Remove ${name} (a resume keeps at least ${minimum})`}
                  disabled={saving || !canRemove}
                  onClick={() => onRemove(slot)}
                />
              </div>
              {index > 0 && (
                <Button variant="tertiary" size="sm" disabled={saving} className="self-start" onClick={() => draft.move(slot.key, 0)}>
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
              disabled={saving}
              aria-haspopup="dialog"
              className="flex aspect-4/3 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong bg-surface font-bold text-primary transition-colors duration-200 ease-out hover:border-primary hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Icon name="upload" className="size-6" />
              Add photo
            </button>
          </li>
        )}
      </ul>
      {!canRemove && slots.length > 0 && (
        <p className="text-sm text-ink-muted">
          {pet.status === "draft"
            ? "A resume keeps at least one photo. Add another before removing this one."
            : `A published resume keeps at least ${RESUME_LIMITS.minPhotos} photos. Add another before removing one.`}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <p className="font-bold">
            Cover photo <span className="font-normal text-ink-muted">(optional)</span>
          </p>
          <p className="text-sm text-ink-muted">A wide photo across the top of your resume. JPG or PNG, up to 5 MB.</p>
        </div>
        {coverUrl && (
          <div className="relative">
            <Photo ratio="cover" src={coverUrl} alt={`${pet.name}'s cover photo`} sizes="(min-width: 768px) 760px, 100vw" />
            {cover && (
              <Badge tone="progress" className="absolute top-2 left-2">
                Not saved yet
              </Badge>
            )}
          </div>
        )}
        <Button
          variant="secondary"
          icon={<Icon name="upload" className="size-4 shrink-0" />}
          disabled={saving}
          className="self-start"
          aria-haspopup="dialog"
          onClick={onChangeCover}
        >
          {coverUrl ? "Replace the cover photo" : "Add a cover photo"}
        </Button>
      </div>
    </>
  );
}
