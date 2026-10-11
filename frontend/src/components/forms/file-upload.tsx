"use client";

import { type DragEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { FieldMessages } from "./field-messages";

// Client-side checks are for fast feedback only. The API re-validates type by content, size and count, renames and
// re-encodes files (security-guidelines SEC-FILE-01…05). SVG and HTML are never accepted.

export type FileKind = "jpg" | "png" | "pdf";

const KINDS: Record<FileKind, { label: string; types: string[]; extensions: string[]; signature: number[] }> = {
  jpg: { label: "JPG", types: ["image/jpeg"], extensions: [".jpg", ".jpeg"], signature: [0xff, 0xd8, 0xff] },
  png: {
    label: "PNG",
    types: ["image/png"],
    extensions: [".png"],
    signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  pdf: { label: "PDF", types: ["application/pdf"], extensions: [".pdf"], signature: [0x25, 0x50, 0x44, 0x46, 0x2d] },
};

const MB = 1024 * 1024;

type Item = { id: number; file: File; kind: FileKind; previewUrl?: string };

type Props = {
  label: ReactNode;
  /** Defaults to the accepted types and size limit, e.g. "JPG, PNG or PDF, up to 5 MB." */
  hint?: ReactNode;
  /** Error from the server or the form, shown with the file checks' own messages. */
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  accept?: FileKind[];
  maxSizeMb?: number;
  multiple?: boolean;
  /** Defaults to 5 when `multiple`, otherwise 1. */
  maxFiles?: number;
  /** Keeps the native input's files in sync so a plain FormData(form) includes them. */
  name?: string;
  onFilesChange?: (files: File[]) => void;
  className?: string;
};

function listText(labels: string[]): string {
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}` : labels[0];
}

function formatSize(bytes: number): string {
  return bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / MB).toFixed(1)} MB`;
}

// Reads the first bytes, so a renamed file (virus.exe → photo.jpg) is caught before it is uploaded.
async function detectKind(file: File, allowed: FileKind[]): Promise<FileKind | null> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const name = file.name.toLowerCase();
  return (
    allowed.find((kind) => {
      const { signature, extensions } = KINDS[kind];
      return extensions.some((ext) => name.endsWith(ext)) && signature.every((byte, i) => head[i] === byte);
    }) ?? null
  );
}

export function FileUpload({
  label,
  hint,
  error,
  required = false,
  optional = false,
  accept = ["jpg", "png", "pdf"],
  maxSizeMb = 5,
  multiple = false,
  maxFiles,
  name,
  onFilesChange,
  className,
}: Props) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const hintId = `${baseId}-hint`;
  const errorId = `${baseId}-error`;

  const limit = maxFiles ?? (multiple ? 5 : 1);
  const typesText = listText(accept.map((k) => KINDS[k].label));
  const acceptAttr = accept.flatMap((k) => [...KINDS[k].extensions, ...KINDS[k].types]).join(",");
  const hintText = hint ?? `${typesText}, up to ${maxSizeMb} MB${limit > 1 ? `. Up to ${limit} files.` : "."}`;

  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const [items, setItems] = useState<Item[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);
  const refocus = useRef(false);

  const full = multiple && items.length >= limit;
  const shownError =
    error || problems.length > 0 ? (
      <>
        {error && <span className="block">{error}</span>}
        {problems.map((p) => (
          <span key={p} className="block">
            {p}
          </span>
        ))}
      </>
    ) : null;
  const describedBy = [shownError ? errorId : null, hintId].filter(Boolean).join(" ");

  // Keep the native input in step with the list (for FormData), and free preview URLs when the component goes away.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
    if (name && inputRef.current && typeof DataTransfer !== "undefined") {
      const transfer = new DataTransfer();
      items.forEach((item) => transfer.items.add(item.file));
      inputRef.current.files = transfer.files;
    }
  }, [items, name]);

  useEffect(
    () => () => itemsRef.current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl)),
    [],
  );

  // After a file is removed, return focus to the picker (it may have been disabled while the list was full).
  useEffect(() => {
    if (refocus.current && !full) {
      inputRef.current?.focus();
      refocus.current = false;
    }
  }, [items, full]);

  function commit(next: Item[]) {
    setItems(next);
    onFilesChange?.(next.map((item) => item.file));
  }

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    const found: string[] = [];
    const room = multiple ? limit - items.length : 1;

    if (incoming.length > room) {
      found.push(`You can add up to ${limit} ${limit === 1 ? "file" : "files"}. Extra files were left out.`);
    }

    const accepted: Item[] = [];
    for (const file of incoming.slice(0, Math.max(room, 0))) {
      if (file.size === 0) {
        found.push(`${file.name} is empty.`);
        continue;
      }
      if (file.size > maxSizeMb * MB) {
        found.push(`${file.name} is larger than ${maxSizeMb} MB.`);
        continue;
      }
      const kind = await detectKind(file, accept);
      if (!kind) {
        found.push(`${file.name} isn't a ${typesText} file.`);
        continue;
      }
      accepted.push({
        id: nextId.current++,
        file,
        kind,
        previewUrl: kind === "pdf" ? undefined : URL.createObjectURL(file),
      });
    }

    setProblems(found);
    if (accepted.length > 0) {
      let next = [...items, ...accepted];
      if (!multiple) {
        items.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
        next = accepted.slice(0, 1);
      }
      commit(next);
      setStatus(accepted.length === 1 ? `Added ${accepted[0].file.name}.` : `Added ${accepted.length} files.`);
    }
    if (!name && inputRef.current) inputRef.current.value = "";
  }

  function remove(item: Item) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    commit(items.filter((i) => i.id !== item.id));
    setProblems([]);
    setStatus(`Removed ${item.file.name}.`);
    refocus.current = true;
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!full) void addFiles(event.dataTransfer.files);
  }

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-bold text-ink">
        {label}
        {optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>

      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border-[1.5px] border-dashed p-4",
          "text-center transition-colors duration-200 ease-out has-focus-visible:focus-ring",
          full
            ? "cursor-not-allowed border-line bg-surface-sunken text-ink-muted"
            : "border-line-strong bg-surface-sunken text-ink hover:border-primary hover:bg-primary-soft",
          shownError && !full && "border-danger",
          dragging && "border-primary bg-primary-soft",
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          name={name}
          accept={acceptAttr}
          multiple={multiple}
          required={required && items.length === 0}
          disabled={full}
          aria-describedby={describedBy}
          aria-invalid={shownError ? true : undefined}
          onChange={(event) => void addFiles(event.target.files)}
          className="sr-only"
        />
        <span aria-hidden="true" className="flex flex-col items-center gap-1">
          <Icon name="upload" className={cn("size-6", full ? "text-ink-subtle" : "text-primary")} />
          {full ? (
            <span className="text-sm">Limit reached. Remove a file to add another.</span>
          ) : (
            <span className="text-sm">
              <span className="font-bold text-primary underline">{multiple ? "Choose files" : "Choose a file"}</span>
              <span className="hidden md:inline"> or drag {multiple ? "them" : "it"} here</span>
            </span>
          )}
        </span>
      </label>

      <FieldMessages hintId={hintId} errorId={errorId} hint={hintText} error={shownError} />

      {items.length > 0 && (
        <ul aria-label="Selected files" className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-card border border-line bg-surface p-2">
              {item.previewUrl ? (
                // Local blob previews can't go through next/image's optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl} alt="" className="size-14 shrink-0 rounded-control object-cover" />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-control bg-surface-sunken text-ink-muted">
                  <Icon name="file" className="size-6" />
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold text-ink">{item.file.name}</span>
                <span className="text-xs text-ink-muted">
                  {KINDS[item.kind].label}, {formatSize(item.file.size)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Remove ${item.file.name}`}
                className="grid size-11 shrink-0 place-items-center rounded-pill text-ink-muted transition-colors duration-200 hover:bg-surface-sunken hover:text-ink"
              >
                <Icon name="x" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
