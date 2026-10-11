import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "@/app/admin/layout";

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  counts: vi.fn(),
  api: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/render-account", () => ({ renderAccount: mocks.account }));
vi.mock("@/lib/api/server", () => ({ getServerApi: mocks.api }));
vi.mock("@/features/accounts/api/admin-sidebar", () => ({ getAdminSidebarCounts: mocks.counts }));
vi.mock("@/components/layout/admin-shell", () => ({ AdminShell: () => null }));
vi.mock("@/features/accounts/components/admin-section-seen", () => ({ AdminSectionSeen: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockResolvedValue({});
  mocks.counts.mockResolvedValue({ verification: 3, reports: 2, requests: 1 });
});

describe("admin layout authentication and sidebar", () => {
  it.each([
    [null, "/sign-in?next=%2Fadmin"],
    [{ role: "human", status: "active" }, "/feed"],
    [{ role: "admin", status: "suspended" }, "/account-status"],
  ])("redirects an unauthorized visitor before loading sidebar counts", async (account, path) => {
    mocks.account.mockResolvedValue({ ok: true, account });
    await expect(AdminLayout({ children: null })).rejects.toThrow(`redirect:${path}`);
    expect(mocks.api).not.toHaveBeenCalled();
    expect(mocks.counts).not.toHaveBeenCalled();
  });

  it("fails closed when session verification fails", async () => {
    const error = new Error("session unavailable");
    mocks.account.mockResolvedValue({ ok: false, error });
    await expect(AdminLayout({ children: null })).rejects.toBe(error);
    expect(mocks.counts).not.toHaveBeenCalled();
  });

  it("renders the new section counts for an active admin", async () => {
    mocks.account.mockResolvedValue({ ok: true, account: { role: "admin", status: "active" } });
    const result = await AdminLayout({ children: null });
    expect(result.props.counts).toEqual({ verification: 3, reports: 2, requests: 1 });
  });

  it("keeps the admin shell available when sidebar counts fail", async () => {
    mocks.account.mockResolvedValue({ ok: true, account: { role: "admin", status: "active" } });
    mocks.counts.mockRejectedValue(new Error("counts unavailable"));
    const result = await AdminLayout({ children: null });
    expect(result.props.counts).toEqual({});
  });
});
