import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/utils/format-date";

describe("format-date", () => {
  it("shows API dates in Philippine time, whatever the machine's time zone", () => {
    expect(formatDate("2026-09-13T06:48:00.000000Z")).toBe("Sep 13, 2026");
    expect(formatDateTime("2026-09-13T06:48:00.000000Z")).toBe("Sep 13, 2026, 2:48 PM");
    // 17:30 UTC is already the next day in Manila (UTC+8).
    expect(formatDate("2026-09-13T17:30:00.000000Z")).toBe("Sep 14, 2026");
    expect(formatDateTime("2026-09-13T17:30:00.000000Z")).toBe("Sep 14, 2026, 1:30 AM");
  });

  it("is empty for a value that isn't a date", () => {
    expect(formatDate("")).toBe("");
    expect(formatDateTime("not a date")).toBe("");
  });
});
