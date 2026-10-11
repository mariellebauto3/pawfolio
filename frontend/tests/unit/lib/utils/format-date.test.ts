import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMeetingTime, formatTimeAgo, meetingTimeParts, philippineTimeToIso, philippineToday } from "@/lib/utils/format-date";

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

  it("says how long ago something happened, as a list of notifications does", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    const ago = (ms: number) => formatTimeAgo(new Date(now.getTime() - ms).toISOString(), now);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    expect(ago(0)).toBe("Just now");
    expect(ago(59_000)).toBe("Just now");
    expect(ago(minute)).toBe("1m ago");
    expect(ago(59 * minute)).toBe("59m ago");
    expect(ago(hour)).toBe("1h ago");
    expect(ago(23 * hour + 59 * minute)).toBe("23h ago");
    expect(ago(day)).toBe("1d ago");
    expect(ago(6 * day)).toBe("6d ago");
    expect(ago(7 * day)).toBe("1w ago");
    expect(ago(34 * day)).toBe("4w ago");
    // Older than that, the date says more than a count of weeks.
    expect(ago(35 * day)).toBe("Sep 4, 2026");
    // The API's own format, and a clock that runs behind the server's.
    expect(formatTimeAgo("2026-10-09T10:00:00+00:00", now)).toBe("2h ago");
    expect(formatTimeAgo("2026-10-09T12:00:30.000Z", now)).toBe("Just now");
    expect(formatTimeAgo("yesterday", now)).toBe("");
  });

  it("writes a meeting time with its weekday, in Philippine time", () => {
    // 02:00 UTC on a Saturday is 10:00 that morning in Manila.
    expect(formatMeetingTime("2026-10-10T02:00:00.000000Z")).toBe("Sat, Oct 10, 10:00 AM");
    expect(meetingTimeParts("2026-10-10T02:00:00.000000Z")).toEqual({ weekday: "Sat", month: "Oct", day: "10", time: "10:00 AM" });
    // 18:30 UTC on Saturday is already Sunday there.
    expect(formatMeetingTime("2026-10-10T18:30:00.000000Z")).toBe("Sun, Oct 11, 2:30 AM");
    expect(formatMeetingTime("soon")).toBe("");
    expect(meetingTimeParts("")).toBeNull();
  });

  it("reads a typed date and time as Philippine time", () => {
    expect(philippineTimeToIso("2026-10-10", "10:00")).toBe("2026-10-10T02:00:00.000Z");
    // Early morning there is still the day before in UTC.
    expect(philippineTimeToIso("2026-10-10", "07:30")).toBe("2026-10-09T23:30:00.000Z");
    expect(philippineTimeToIso("2026-10-10", "")).toBeNull();
    expect(philippineTimeToIso("10/10/2026", "10:00")).toBeNull();
    expect(philippineTimeToIso("2026-02-30", "10:00")).toBeNull();
    expect(philippineTimeToIso("2026-10-10", "25:00")).toBeNull();
  });

  it("knows today's date in the Philippines", () => {
    expect(philippineToday(new Date("2026-10-08T15:59:00.000Z"))).toBe("2026-10-08");
    // 16:00 UTC is midnight in Manila.
    expect(philippineToday(new Date("2026-10-08T16:00:00.000Z"))).toBe("2026-10-09");
  });
});
