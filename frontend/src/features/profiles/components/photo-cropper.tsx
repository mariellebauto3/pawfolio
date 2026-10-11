"use client";

import { type KeyboardEvent, type PointerEvent, useId, useRef, useState } from "react";
import { cropRect } from "../schemas/resume-schemas";

export type Crop = { zoom: number; panX: number; panY: number };

export const NO_CROP: Crop = { zoom: 1, panX: 0, panY: 0 };

const MAX_ZOOM = 3;
const MAX_OUTPUT_WIDTH = 1600;
const clamp = (value: number) => Math.min(Math.max(value, -1), 1);

type Props = {
  /** The chosen photo, as an address the browser can show (a `blob:` URL the dialog makes and releases). */
  src: string;
  crop: Crop;
  onChange: (crop: Crop) => void;
};

// The crop preview of the Add photo dialog (PR-09): the photo in a 4:3 frame, as it will show on the resume. Drag
// it, or use the arrow keys, to choose what stays in view; the slider zooms. The cropping itself happens in
// `cropToFile` when the photo is added, so nothing is uploaded until then.
export function PhotoCropper({ src, crop, onChange }: Props) {
  const zoomId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  // Known once the photo has loaded. Give the cropper a `key` of its `src` so a new photo starts over.
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const rect = size ? cropRect(size.width, size.height, crop.zoom, crop.panX, crop.panY) : null;

  /** Moves the view by a share of the frame: 1 is a whole frame width or height. */
  function panBy(dx: number, dy: number) {
    if (!size || !rect) return;
    const rangeX = (size.width - rect.width) / 2;
    const rangeY = (size.height - rect.height) / 2;
    onChange({
      ...crop,
      panX: rangeX > 0 ? clamp(crop.panX + (dx * rect.width) / rangeX) : 0,
      panY: rangeY > 0 ? clamp(crop.panY + (dy * rect.height) / rangeY) : 0,
    });
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    drag.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const box = frame.current?.getBoundingClientRect();
    if (!drag.current || !box) return;
    // Dragging the photo right shows more of its left side.
    panBy(-(event.clientX - drag.current.x) / box.width, -(event.clientY - drag.current.y) / box.height);
    drag.current = { x: event.clientX, y: event.clientY };
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[event.key];
    if (!step) return;
    event.preventDefault();
    panBy(step[0], step[1]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frame}
        role="group"
        tabIndex={0}
        aria-label="Crop preview. Drag the photo, or use the arrow keys, to choose what shows."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
        className="relative aspect-4/3 w-full cursor-grab touch-none overflow-hidden rounded-card border border-line bg-surface-sunken select-none active:cursor-grabbing"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          className="pointer-events-none absolute max-w-none"
          style={
            size && rect
              ? {
                  width: `${(size.width / rect.width) * 100}%`,
                  left: `${(-rect.x / rect.width) * 100}%`,
                  top: `${(-rect.y / rect.height) * 100}%`,
                }
              : { width: "100%", opacity: 0 }
          }
        />
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={zoomId} className="text-sm font-bold">
          Zoom
        </label>
        <input
          id={zoomId}
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.05}
          value={crop.zoom}
          onChange={(event) => onChange({ ...crop, zoom: Number(event.target.value) })}
          className="min-w-0 flex-1 accent-primary"
        />
      </div>
    </div>
  );
}

/** The cropped photo as a JPEG file, 4:3 and at most 1600 px wide, ready to upload. */
export async function cropToFile(file: File, crop: Crop): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const rect = cropRect(bitmap.width, bitmap.height, crop.zoom, crop.panX, crop.panY);
    const width = Math.round(Math.min(rect.width, MAX_OUTPUT_WIDTH));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round((width * 3) / 4);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No canvas");
    context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("No image");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
