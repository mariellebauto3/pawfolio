import { beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout from "@/app/layout";

const context = vi.hoisted(() => ({ path: "/admin/reports", lookup: { ok: true, account: null } as unknown }));
vi.mock("@/lib/auth/render-account", () => ({ renderAccount: async () => context.lookup }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-pawfolio-path": context.path }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/font/google", () => ({ Atkinson_Hyperlegible_Next: () => ({ variable: "body" }), Zilla_Slab: () => ({ variable: "display" }) }));
vi.mock("@/providers/session-provider", () => ({ SessionProvider: () => null }));
vi.mock("@/providers/toast-provider", () => ({ ToastProvider: () => null }));

beforeEach(() => { context.path = "/admin/reports"; });
describe("server navigation verification", () => {
  it.each([
    [null, "/sign-in?next=%2Fadmin%2Freports"],
    [{ id: 1, role: "human", status: "active" }, "/feed"],
    [{ id: 1, role: "admin", status: "suspended" }, "/account-status"],
  ])("redirects a disallowed account after the shared lookup", async (account, target) => {
    context.lookup = { ok: true, account };
    await expect(RootLayout({ children: null, params: Promise.resolve({}) })).rejects.toThrow(`redirect:${target}`);
  });
  it("renders for an active admin", async () => {
    context.lookup = { ok: true, account: { id: 1, role: "admin", status: "active" } };
    await expect(RootLayout({ children: null, params: Promise.resolve({}) })).resolves.toBeDefined();
  });
});

