import { describe, expect, it } from "vitest";
import { requestOrigin } from "@/lib/auth/request-origin";

describe("requestOrigin", () => {
  it("uses the deployed public host instead of the configured localhost or internal host", () => {
    expect(requestOrigin(new Headers({ host: "internal:3000", "x-forwarded-host": "pawfolio-service.vercel.app", "x-forwarded-proto": "https" }))).toBe("https://pawfolio-service.vercel.app");
  });

  it("supports local development", () => {
    expect(requestOrigin(new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }))).toBe("http://localhost:3000");
  });

  it("does not accept credentials or paths in the forwarded host", () => {
    for (const host of ["user@evil.example", "evil.example/path", "one.example,two.example"]) {
      expect(requestOrigin(new Headers({ "x-forwarded-host": host, "x-forwarded-proto": "https" }))).toBe(requestOrigin(new Headers()));
    }
  });
});
