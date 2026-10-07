"use client";

import { useState } from "react";
import { PhotoViewer } from "@/components/overlays/photo-viewer";
import { Photo } from "@/components/ui/photo";
import type { PetPhoto } from "@/types/pet";

type Props = {
  /** Whose photos they are, for the descriptions: "Mochi". */
  name: string;
  /** In the order the resume shows them; the first is the profile photo. */
  photos: PetPhoto[];
};

// The Photos section of a resume (PR-01, DS-05): a grid of the pet's photos, each of which opens the full-size
// viewer on that photo (DS-06). Captions are typed by the caretaker and rendered as plain text (SEC-FE-01).
export function PhotoGallery({ name, photos }: Props) {
  const [viewing, setViewing] = useState<number | null>(null);

  const described = photos.map((photo, index) => ({
    ...photo,
    alt: photo.caption ? `${name}: ${photo.caption}` : `${name}, photo ${index + 1}`,
  }));

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {described.map((photo, index) => (
          <li key={photo.id}>
            <figure className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setViewing(index)}
                aria-label={`View full size: ${photo.alt}`}
                className="block w-full cursor-zoom-in rounded-card transition-opacity duration-200 ease-out hover:opacity-85"
              >
                <Photo src={photo.url} alt={photo.alt} sizes="(min-width: 768px) 260px, 50vw" />
              </button>
              {photo.caption && <figcaption className="text-sm text-ink-muted">{photo.caption}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>

      <PhotoViewer
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={`${name}’s photos`}
        photos={described.map(({ id, url, alt, caption }) => ({ id, src: url, alt, caption }))}
        index={viewing ?? 0}
        onIndexChange={setViewing}
      />
    </>
  );
}
