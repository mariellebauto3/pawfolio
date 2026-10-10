"use client";

import { type KeyboardEvent, type PointerEvent, useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { niceMax } from "../schemas/stats";

export type LineSeries = {
  id: string;
  label: string;
  values: number[];
  /** The line's colour and dash. Three at most: a fourth series belongs in another chart. */
  tone: "primary" | "primary-light" | "accent";
};

type Props = {
  /** What the chart shows: "Profile views per day". Read by screen readers and used as the table's caption. */
  label: string;
  /** One label per point, in order: "Oct 10". */
  points: string[];
  series: LineSeries[];
  /** What a value counts, in the table's header and the readout: "Views". */
  unit: string;
  className?: string;
};

// Sent, Approved, Adopted read as steps of one path: light blue (dashed, since it is the faintest on white), blue,
// then yellow for the good news. Checked for colour-blind separation; the readout and the table carry the numbers.
const STROKES: Record<LineSeries["tone"], string> = { primary: "stroke-blue-600", "primary-light": "stroke-blue-300", accent: "stroke-yellow-600" };
const DOTS: Record<LineSeries["tone"], string> = { primary: "bg-blue-600", "primary-light": "bg-blue-300", accent: "bg-yellow-600" };
const DASHES: Record<LineSeries["tone"], string | undefined> = { primary: undefined, "primary-light": "5 4", accent: undefined };

/** Which x labels to write under the plot: all of them when few, otherwise the first, the middle and the last. */
function shownLabels(count: number): Set<number> {
  if (count <= 7) return new Set(Array.from({ length: count }, (_, index) => index));
  return new Set([0, Math.floor((count - 1) / 2), count - 1]);
}

// Change over time (AN-01 views per day, AN-03 requests per month). The SVG draws only the grid and the lines, with
// strokes that keep their width at any size; labels, dots and the readout are HTML placed by percentage, so the
// chart is the same on the server and in the browser and needs no measuring. Point at it, or focus it and press
// ← →, to read one point; every number is also in a table for screen readers.
export function LineChart({ label, points, series, unit, className }: Props) {
  const readoutId = useId();
  const [active, setActive] = useState<number | null>(null);
  const last = Math.max(points.length - 1, 1);
  const top = niceMax(series.flatMap((line) => line.values));
  const x = (index: number) => (index / last) * 100;
  const y = (value: number) => 100 - (value / top) * 100;
  const labels = shownLabels(points.length);

  function pointAt(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const ratio = Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1);
    setActive(Math.round(ratio * last));
  }

  function step(event: KeyboardEvent<HTMLDivElement>) {
    const move = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : event.key === "Home" ? -Infinity : event.key === "End" ? Infinity : null;
    if (move === null) return;
    event.preventDefault();
    setActive((current) => Math.min(Math.max((current ?? points.length - 1) + move, 0), points.length - 1));
  }

  return (
    <figure className={cn("flex flex-col gap-3", className)}>
      {series.length > 1 && (
        <ul aria-hidden="true" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {series.map((line) => (
            <li key={line.id} className="flex items-center gap-2">
              <svg width="24" height="8" viewBox="0 0 24 8" className="shrink-0">
                <line x1="0" y1="4" x2="24" y2="4" strokeWidth="2.5" strokeDasharray={DASHES[line.tone]} className={STROKES[line.tone]} />
              </svg>
              {line.label}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
        {/* The scale: the top, the middle and zero, beside the lines they belong to. */}
        <div aria-hidden="true" className="flex h-44 flex-col justify-between text-right text-xs text-ink-muted tabular-nums">
          <span className="-translate-y-1/2">{top}</span>
          <span>{top / 2}</span>
          <span className="translate-y-1/2">0</span>
        </div>

        <div
          role="group"
          tabIndex={0}
          aria-label={`${label}. Press the left and right arrow keys to read each point.`}
          onPointerMove={pointAt}
          onPointerDown={pointAt}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={step}
          className="relative h-44 touch-pan-y rounded-badge"
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
            {[0, 50, 100].map((line) => (
              <line key={line} x1="0" x2="100" y1={line} y2={line} vectorEffect="non-scaling-stroke" strokeWidth="1" className={line === 100 ? "stroke-line-strong" : "stroke-line"} />
            ))}
            {series.map((line) => (
              <polyline
                key={line.id}
                fill="none"
                points={line.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
                vectorEffect="non-scaling-stroke"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={DASHES[line.tone]}
                className={STROKES[line.tone]}
              />
            ))}
          </svg>

          {active !== null && (
            <>
              <span aria-hidden="true" className="absolute inset-y-0 w-px bg-line-strong" style={{ left: `${x(active)}%` }} />
              {series.map((line) => (
                <span
                  key={line.id}
                  aria-hidden="true"
                  className={cn("absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-pill ring-2 ring-surface", DOTS[line.tone])}
                  style={{ left: `${x(active)}%`, top: `${y(line.values[active] ?? 0)}%` }}
                />
              ))}
              {/* The readout keeps to the side of the pointer that has room, so it never leaves the card. */}
              <div
                aria-hidden="true"
                className={cn("pointer-events-none absolute top-0 z-10 flex flex-col gap-0.5 rounded-control bg-surface-inverse px-3 py-2 text-sm whitespace-nowrap text-ink-inverse shadow-menu", x(active) > 50 ? "-translate-x-full" : "")}
                style={{ left: `calc(${x(active)}% + ${x(active) > 50 ? "-0.75rem" : "0.75rem"})` }}
              >
                <span className="font-bold">{points[active]}</span>
                {series.map((line) => (
                  <span key={line.id} className="tabular-nums">
                    {series.length > 1 ? `${line.label}: ` : `${unit}: `}
                    {line.values[active] ?? 0}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div aria-hidden="true" className="relative col-start-2 mt-2 h-4 text-xs text-ink-muted">
          {points.map((point, index) =>
            labels.has(index) ? (
              <span key={index} className={cn("absolute whitespace-nowrap", index === 0 ? "" : index === points.length - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${x(index)}%` }}>
                {point}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* The same readout for screen readers: there before a point is chosen, so each move is announced. */}
      <p id={readoutId} aria-live="polite" className="sr-only">
        {active !== null && `${points[active]}: ${series.map((line) => `${series.length > 1 ? line.label : unit} ${line.values[active] ?? 0}`).join(", ")}`}
      </p>

      {/* A table ignores the 1px box of sr-only and would widen the page, so a wrapper carries it. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">When</th>
              {series.map((line) => (
                <th key={line.id} scope="col">
                  {series.length > 1 ? line.label : unit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={index}>
                <th scope="row">{point}</th>
                {series.map((line) => (
                  <td key={line.id}>{line.values[index] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
