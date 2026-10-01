"use client";

import { type ChangeEvent, type Ref, type TextareaHTMLAttributes, useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { CONTROL_CLASSES, READ_ONLY_CLASSES } from "./control-styles";
import { useFieldControl } from "./field-context";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Shows "count / maxLength" under the box. On by default when maxLength is set. */
  showCount?: boolean;
  ref?: Ref<HTMLTextAreaElement>;
};

type Level = "short" | "ok" | "near" | "full";

// Screen readers hear the count when they reach the box (aria-describedby), and a live message only when the text
// crosses a threshold, not on every keystroke.
const ANNOUNCE: Record<Level, (remaining: number) => string> = {
  short: () => "",
  ok: () => "Minimum length reached.",
  near: (remaining) => `${remaining} characters left.`,
  full: () => "Character limit reached.",
};

function levelOf(count: number, min?: number, max?: number): Level {
  if (min !== undefined && count < min) return "short";
  if (max !== undefined && count >= max) return "full";
  if (max !== undefined && max - count <= Math.max(20, Math.round(max * 0.1))) return "near";
  return "ok";
}

export function Textarea({
  showCount,
  maxLength,
  minLength,
  value,
  defaultValue,
  onChange,
  rows = 4,
  className,
  ...props
}: Props) {
  const counterId = useId();
  const counted = showCount ?? maxLength !== undefined;
  const field = useFieldControl(props, counted ? counterId : undefined);

  const [innerCount, setInnerCount] = useState(() => String(defaultValue ?? "").length);
  const count = value !== undefined ? String(value).length : innerCount;

  const level = levelOf(count, minLength, maxLength);
  const [announced, setAnnounced] = useState<{ level: Level; text: string }>({ level, text: "" });
  // Adjust the live message during render when the level changes (no effect needed).
  if (announced.level !== level) {
    setAnnounced({ level, text: ANNOUNCE[level](maxLength !== undefined ? maxLength - count : 0) });
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setInnerCount(event.target.value.length);
    onChange?.(event);
  }

  const short = minLength !== undefined && count < minLength;

  return (
    <div className="flex flex-col gap-1">
      <textarea
        {...props}
        {...field}
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        minLength={minLength}
        onChange={handleChange}
        className={cn(CONTROL_CLASSES, READ_ONLY_CLASSES, "resize-y leading-normal", className)}
      />
      {counted && (
        <div className="flex justify-end gap-3 text-xs text-ink-muted tabular-nums">
          {short && count > 0 && <span aria-hidden="true">{minLength - count} more needed</span>}
          <span aria-hidden="true" className={cn(level === "full" && "font-bold text-ink")}>
            {count}
            {maxLength !== undefined && ` / ${maxLength}`}
          </span>
          <span id={counterId} className="sr-only">
            {maxLength !== undefined ? `${count} of ${maxLength} characters used.` : `${count} characters.`}
            {short && ` At least ${minLength} needed.`}
          </span>
          <span aria-live="polite" className="sr-only">
            {announced.text}
          </span>
        </div>
      )}
    </div>
  );
}
