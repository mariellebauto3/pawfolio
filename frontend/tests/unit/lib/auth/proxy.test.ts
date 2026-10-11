import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config } from "@/proxy";
import { lookUpAccount } from "@/lib/auth/lookup-account";
import type { Account } from "@/types/account";

vi.mock("@/lib/auth/lookup-account", () => ({ lookUpAccount: vi.fn() }));
const lookup = vi.mocked(lookUpAccount);
const account = (role: Account["role"]): Account => ({
  id: 1, role, status: "active", email: "test@example.com", display_name: "Test", avatar_url: null, profile_id: null,
});
const request = (path: string) => new NextRequest(`http://localhost:3000${path}`);

beforeEach(() => lookup.mockReset());

describe("navigation access", () => {
  it.each(["/feed", "/admin/reports", "/resume/edit", "/account/edit", "/admin/reports/private.json"])("redirects signed-out requests to %s before rendering", async (path) => {
    lookup.mockResolvedValue(null);
    const response = await proxy(request(path));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/sign-in");
    expect(response.headers.get("x-middleware-next")).toBeNull();
  });

  it.each([
    ["pet", "/admin/reports", "/feed"],
    ["human", "/resume/edit", "/feed"],
    ["human", "/%61dmin/reports", "/feed"],
    ["pet", "/availability", "/feed"],
    ["admin", "/feed", "/admin"],
    ["admin", "/", "/admin"],
    ["human", "/", "/feed"],
  ] as const)("redirects %s visiting %s to %s", async (role, path, home) => {
    lookup.mockResolvedValue(account(role));
    const response = await proxy(request(path));
    expect(response.headers.get("location")).toBe(`http://localhost:3000${home}`);
    expect(response.headers.get("x-middleware-next")).toBeNull();
  });

  it("allows an authorized request", async () => {
    lookup.mockResolvedValue(account("admin"));
    expect((await proxy(request("/admin/reports"))).headers.get("x-middleware-next")).toBe("1");
  });

  it("does not render protected content when the session check fails", async () => {
    lookup.mockResolvedValue(undefined);
    const response = await proxy(request("/admin/reports"));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-middleware-next")).toBeNull();
    expect(await response.text()).not.toMatch(/admin|report/i);
  });

  it("checks module URLs containing dots", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test("/admin/reports/private.json")).toBe(true);
    expect(matcher.test("/images/brand/pawfolio-mark.svg")).toBe(false);
  });
});
