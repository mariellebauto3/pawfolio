import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSignIn } from "@/features/auth/hooks/use-sign-in";
import type { Account } from "@/types/account";

const mocks = vi.hoisted(() => ({
  transport: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  refresh: vi.fn(),
  announce: vi.fn(),
}));

// The test invokes the hook's action directly; React's memoization does not affect the async login flow.
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useCallback: <T>(callback: T) => callback,
}));
vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({ account: null, refresh: mocks.refresh, pauseSessionChecks: mocks.pause }),
}));
vi.mock("@/lib/auth/session-sync", () => ({ announceSessionChange: mocks.announce }));
vi.mock("@/lib/api/client", async () => {
  const { createApiClient } = await import("@/lib/api/core");
  return { api: createApiClient((request) => mocks.transport(request)) };
});

const input = { email: "test@example.com", password: "password", remember: true };
const account = (role: Account["role"], status: Account["status"] = "active"): Account => ({
  id: 1, role, status, email: input.email, display_name: "Test", avatar_url: null, profile_id: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pause.mockReturnValue(mocks.resume);
});

describe("sign-in transition", () => {
  it.each([
    ["admin", "active", "/admin"],
    ["pet", "active", "/feed"],
    ["human", "active", "/feed"],
    ["human", "pending_verification", "/account-status"],
  ] as const)("keeps %s pending until %s navigation replaces the guest document", async (role, status, destination) => {
    let finishRequest!: (value: unknown) => void;
    mocks.transport.mockImplementation(() => new Promise((resolve) => { finishRequest = resolve; }));
    let finishNavigation!: () => void;
    const navigated = new Promise<void>((resolve) => { finishNavigation = resolve; });
    const replace = vi.fn(() => finishNavigation());
    vi.stubGlobal("window", { location: { replace } });

    let settled = false;
    const action = useSignIn("/admin/reports")(input);
    void action.then(() => { settled = true; });
    expect(mocks.pause).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(mocks.announce).not.toHaveBeenCalled();

    finishRequest({ status: 200, body: { data: account(role, status) }, retryAfter: null });
    await navigated;
    expect(replace).toHaveBeenCalledExactlyOnceWith(destination);
    expect(mocks.announce).toHaveBeenCalledOnce();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(settled).toBe(false);
    expect(mocks.transport).toHaveBeenCalledOnce();
    expect(mocks.transport.mock.calls[0][0]).toMatchObject({ method: "POST", path: "/auth/sign-in", body: input });
  });

  it.each([
    [422, { message: "Invalid credentials", errors: { email: ["Wrong email or password."] } }, "validation"],
    [429, { message: "Too many attempts" }, "rate_limited"],
    [409, { message: "Already signed in", code: "already_signed_in" }, "conflict"],
    [200, { data: { role: "unknown" } }, "server"],
  ])("resumes checks and leaves %s failures on the form", async (status, body, kind) => {
    mocks.transport.mockResolvedValue({ status, body, retryAfter: null });
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    await expect(useSignIn(null)(input)).rejects.toMatchObject({ kind });
    expect(mocks.resume).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(mocks.announce).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("resumes checks after a network failure without leaving the login page", async () => {
    mocks.transport.mockRejectedValue(new TypeError("fetch failed"));
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    await expect(useSignIn(null)(input)).rejects.toMatchObject({ kind: "network" });
    expect(mocks.resume).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    expect(mocks.announce).not.toHaveBeenCalled();
  });
});
