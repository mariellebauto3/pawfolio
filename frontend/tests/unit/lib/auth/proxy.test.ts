import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config } from "@/proxy";

const request = (path: string, cookie?: string) => new NextRequest(`http://localhost:3000${path}`, {
  headers: { ...(cookie ? { cookie } : {}), "x-pawfolio-path": "/forged" },
});

describe("optimistic navigation access", () => {
  it.each(["/feed", "/admin/reports", "/resume/edit", "/account/edit", "/admin/reports/private.json"])("redirects requests without a session from %s", (path) => {
    const response = proxy(request(path));
    expect(response.status).toBe(307);
    const target = new URL(response.headers.get("location")!);
    expect(target.pathname).toBe("/sign-in");
    expect(target.searchParams.get("next")).toBe(path);
  });
  it("does not call an unavailable backend and overwrites a forged path header", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("API unavailable"));
    try {
      const response = proxy(request("/admin/reports?page=2", "pawfolio-session=s1"));
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("x-middleware-request-x-pawfolio-path")).toBe("/admin/reports?page=2");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });
  it("does not mistake a CSRF cookie for a session", () => {
    expect(proxy(request("/admin", "XSRF-TOKEN=abc")).status).toBe(307);
  });
  it("allows public pages without a session", () => {
    expect(proxy(request("/sign-in")).headers.get("x-middleware-next")).toBe("1");
  });
  it("checks module URLs containing dots", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/admin/reports/private.json")).toBe(true);
    expect(matcher.test("/images/brand/pawfolio-mark.svg")).toBe(false);
  });
});
