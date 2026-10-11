import { describe, expect, it } from "vitest";
import { ACCOUNT_NOT_ACTIVE_CODE, ApiError, isApiError, networkError, normalizeApiError } from "@/lib/api/errors";

describe("normalizeApiError", () => {
  it("maps 401 to unauthenticated with our own sign-in message", () => {
    const error = normalizeApiError(401, { message: "Unauthenticated." });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("unauthenticated");
    expect(error.status).toBe(401);
    expect(error.message).toBe("Please sign in to continue.");
  });

  it("maps 403 with the account_not_active code to account_not_active", () => {
    const error = normalizeApiError(403, {
      message: "Your account is pending verification.",
      code: ACCOUNT_NOT_ACTIVE_CODE,
    });
    expect(error.kind).toBe("account_not_active");
    expect(error.code).toBe(ACCOUNT_NOT_ACTIVE_CODE);
    expect(error.message).toBe("Your account is pending verification.");
  });

  it("maps any other 403 to forbidden", () => {
    const error = normalizeApiError(403, { message: "This page is for admins only." });
    expect(error.kind).toBe("forbidden");
    expect(error.message).toBe("This page is for admins only.");
  });

  it("maps 409 to conflict and keeps the rule message and code", () => {
    const error = normalizeApiError(409, {
      message: "You already have 3 open requests.",
      code: "open_request_limit",
    });
    expect(error.kind).toBe("conflict");
    expect(error.message).toBe("You already have 3 open requests.");
    expect(error.code).toBe("open_request_limit");
  });

  it("maps 422 to a field errors map with the first message per field", () => {
    const error = normalizeApiError(422, {
      message: "The cover letter field is required. (and 1 more error)",
      errors: {
        cover_letter: ["The cover letter field is required.", "Another message"],
        "photos.0": ["The photo must be a JPG or PNG."],
      },
    });
    expect(error.kind).toBe("validation");
    expect(error.fieldErrors).toEqual({
      cover_letter: "The cover letter field is required.",
      "photos.0": "The photo must be a JPG or PNG.",
    });
    // Laravel's summary ("… (and 1 more error)") is replaced by a friendly one.
    expect(error.message).toBe("Please check the highlighted fields.");
  });

  it("ignores malformed field errors", () => {
    const error = normalizeApiError(422, { errors: { name: [42], email: "Enter your email.", bio: [] } });
    expect(error.fieldErrors).toEqual({ email: "Enter your email." });
    expect(normalizeApiError(422, { errors: "nope" }).fieldErrors).toEqual({});
  });

  it("only fills field errors for 422", () => {
    expect(normalizeApiError(409, { errors: { name: ["x"] } }).fieldErrors).toEqual({});
  });

  it("maps 404, 419 and 429", () => {
    expect(normalizeApiError(404, null).kind).toBe("not_found");
    expect(normalizeApiError(419, null).kind).toBe("session_expired");
    const limited = normalizeApiError(429, { message: "Too many attempts. Try again in 15 minutes." }, "900");
    expect(limited.kind).toBe("rate_limited");
    expect(limited.message).toBe("Too many attempts. Try again in 15 minutes.");
    expect(limited.retryAfterSeconds).toBe(900);
  });

  it("ignores an unreadable Retry-After", () => {
    expect(normalizeApiError(429, null, "soon").retryAfterSeconds).toBeNull();
  });

  it("never shows server text for 5xx", () => {
    const error = normalizeApiError(500, { message: "SQLSTATE[42S02]: Base table not found", trace: [] });
    expect(error.kind).toBe("server");
    expect(error.message).toBe("Something went wrong on our side. Please try again.");
    expect(normalizeApiError(503, "<html>down</html>").kind).toBe("server");
  });

  it("falls back to a default message when the server message is missing, blank or too long", () => {
    expect(normalizeApiError(409, null).message).toBe("This can't be done right now.");
    expect(normalizeApiError(409, { message: "   " }).message).toBe("This can't be done right now.");
    expect(normalizeApiError(409, { message: "x".repeat(301) }).message).toBe("This can't be done right now.");
    expect(normalizeApiError(409, { message: 42 }).message).toBe("This can't be done right now.");
  });
});

describe("networkError", () => {
  it("is an ApiError with status 0", () => {
    const error = networkError();
    expect(isApiError(error)).toBe(true);
    expect(error.kind).toBe("network");
    expect(error.status).toBe(0);
  });

  it("isApiError rejects other errors", () => {
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError({ kind: "network" })).toBe(false);
  });
});

describe("other 4xx statuses", () => {
  it("maps 413 to payload_too_large and other 4xx to bad_request, not server", () => {
    expect(normalizeApiError(413, null)).toMatchObject({ kind: "payload_too_large", message: expect.stringContaining("too large") });
    expect(normalizeApiError(400, null).kind).toBe("bad_request");
    expect(normalizeApiError(405, null).kind).toBe("bad_request");
    expect(normalizeApiError(500, null).kind).toBe("server");
  });
});
