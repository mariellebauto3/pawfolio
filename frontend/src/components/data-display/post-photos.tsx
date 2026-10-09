"use client";

import Image from "next/image";
import { useState } from "react";
import { PhotoViewer } from "@/components/overlays/photo-viewer";
import { cn } from "@/lib/utils/cn";
import type { PostPhoto } from "@/types/post";

type Props = {
  /** Who posted them, for the descriptions: "Mochi". */
  author: string;
  /** Up to 4, in the post's order. */
  photos: PostPhoto[];
  /** Rendered width hint for the image optimizer: the width of the card the photos fill. */
  sizes?: string;
};

// The frame keeps one shape per count, so a post's height is known before its photos load.
const FRAMES: Record<number, string> = {
  1: "aspect-4/3",
  2: "aspect-2/1 grid-cols-2",
  3: "aspect-4/3 grid-cols-2 grid-rows-2",
  4: "aspect-4/3 grid-cols-2 grid-rows-2",
};

// The photos of a post (FD-01, FD-05), edge to edge in the card: one fills the frame, two sit side by side, three
// put the first beside the other two, four make a grid. Each opens the full-size viewer on that photo. A post's
// photos carry no captions, so each is described by whose post it is from and where it sits.
export function PostPhotos({ author, photos, sizes = "(min-width: 1024px) 552px, 100vw" }: Props) {
  const [viewing, setViewing] = useState<number | null>(null);
  const shown = photos.slice(0, 4);
  if (shown.length === 0) return null;

  const described = shown.map((photo, index) => ({
    id: photo.id,
    src: photo.url,
    alt: shown.length === 1 ? `Photo from ${author}’s post` : `Photo ${index + 1} of ${shown.length} from ${author}’s post`,
  }));

  return (
    <>
      <ul className={cn("grid gap-0.5 overflow-hidden bg-surface-sunken", FRAMES[shown.length])}>
        {described.map((photo, index) => (
          <li key={photo.id} className={cn("relative min-h-0", shown.length === 3 && index === 0 && "row-span-2")}>
            <button
              type="button"
              onClick={() => setViewing(index)}
              aria-label={`View full size: ${photo.alt}`}
              // The frame clips what leaves it, so the focus ring is drawn inside the photo.
              className="absolute inset-0 cursor-zoom-in transition-opacity duration-200 ease-out hover:opacity-90 focus-visible:z-10 focus-visible:-outline-offset-4"
            >
              <Image src={photo.src} alt={photo.alt} fill sizes={shown.length === 1 ? sizes : `(min-width: 1024px) 276px, 50vw`} className="object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <PhotoViewer
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={`Photos from ${author}’s post`}
        photos={described}
        index={viewing ?? 0}
        onIndexChange={setViewing}
      />
    </>
  );
}
