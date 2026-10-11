import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type TableColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** `end` for numbers and dates you compare, and for the actions column. */
  align?: "start" | "end";
  /** Let long text wrap (with a minimum width) instead of staying on one line. */
  wrap?: boolean;
  /** Marks the cell that names the row (usually the first column), so screen readers announce it with each cell. */
  rowHeader?: boolean;
  /** Hide the header text visually but keep it for screen readers, e.g. for an actions column. */
  headerHidden?: boolean;
};

type Props<Row> = {
  /** What the table lists: "Verification queue". Read by screen readers; visible only with `showCaption`. */
  caption: string;
  showCaption?: boolean;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  /** Shown in place of the rows when there are none, usually an EmptyState. */
  empty?: ReactNode;
  /** `false` when the table already sits in a Card with `padding="none"`. */
  framed?: boolean;
  className?: string;
};

// Data table for admin lists and histories. On phones it scrolls sideways inside its card, never the page
// (ui-guidelines §1). The scroll area is focusable and labelled so keyboard users can scroll it too.
export function Table<Row>({
  caption,
  showCaption = false,
  columns,
  rows,
  rowKey,
  empty,
  framed = true,
  className,
}: Props<Row>) {
  return (
    <div className={cn(framed && "overflow-hidden rounded-card border border-line bg-surface", className)}>
      {/* contain-inline-size: the table's width doesn't count toward the parent's minimum size, so a grid or flex
          parent shrinks to the screen and the table scrolls here instead of widening the page. `relative` keeps
          absolutely positioned content (sr-only text) inside the scroll area too. */}
      <div
        role="region"
        aria-label={caption}
        tabIndex={0}
        className="relative overflow-x-auto overscroll-x-contain contain-inline-size"
      >
        <table className="w-full border-collapse text-left">
          <caption
            className={cn(showCaption ? "px-4 pt-4 pb-2 text-left font-display text-xl font-bold" : "sr-only")}
          >
            {caption}
          </caption>
          <thead className="bg-canvas">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-sm font-bold whitespace-nowrap text-ink-muted",
                    column.align === "end" && "text-right",
                  )}
                >
                  {column.headerHidden ? <span className="sr-only">{column.header}</span> : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && empty ? (
              <tr className="border-t border-line">
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="border-t border-line">
                  {columns.map((column) => {
                    const Cell = column.rowHeader ? "th" : "td";
                    return (
                      <Cell
                        key={column.key}
                        scope={column.rowHeader ? "row" : undefined}
                        className={cn(
                          "px-4 py-3 align-middle",
                          column.rowHeader ? "font-bold" : "font-normal",
                          column.wrap ? "min-w-48" : "whitespace-nowrap",
                          column.align === "end" && "text-right tabular-nums",
                        )}
                      >
                        {column.cell(row)}
                      </Cell>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
