"use client";

import Image, { type ImageProps } from "next/image";
import { type ReactNode, useState } from "react";

type Props = Omit<ImageProps, "src" | "onError"> & {
  src: string;
  /** Drawn in the picture's place when it can't be loaded at all: a paw, initials, a short note. */
  fallback: ReactNode;
};

// A picture that never leaves a hole. Photos come from the API's storage through the image optimizer, and either
// can fail for one picture while the page is fine: the optimizer is busy or timed out, the file was removed. So a
// picture gets two tries before it is given up on:
//   1. through the optimizer, as every image;
//   2. straight from where it is stored, in case only the optimizer failed;
//   3. the `fallback`, in the same frame, so the layout and the meaning stay (never a broken-image icon).
// The count belongs to one address: a new `src` starts again from the first try.
export function ApiImage({ src, fallback, alt, unoptimized, ...props }: Props) {
  const [failed, setFailed] = useState({ src, tries: 0 });
  const tries = failed.src === src ? failed.tries : 0;

  if (tries >= 2) return <>{fallback}</>;

  return (
    <Image
      // A new element for the second try: the browser doesn't ask again for an <img> whose address looks the same.
      key={tries}
      {...props}
      src={src}
      alt={alt}
      unoptimized={unoptimized || tries === 1}
      onError={() => setFailed({ src, tries: tries + 1 })}
    />
  );
}
