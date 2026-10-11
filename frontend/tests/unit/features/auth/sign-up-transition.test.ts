import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSignUpWizard } from "@/features/auth/hooks/use-sign-up-wizard";

const mocks = vi.hoisted(() => ({
  pause: vi.fn(), resume: vi.fn(), refresh: vi.fn(), announce: vi.fn(), saved: vi.fn(), problem: vi.fn(),
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => [initial, mocks.problem],
  useRef: (initial: unknown) => ({ current: initial }),
  useEffect: vi.fn(),
}));
vi.mock("@/providers/session-provider", () => ({
  useSession: () => ({ refresh: mocks.refresh, pauseSessionChecks: mocks.pause }),
}));
vi.mock("@/lib/auth/session-sync", () => ({ announceSessionChange: mocks.announce }));
vi.mock("@/features/auth/hooks/use-form-fields", () => ({
  useFormFields: () => ({ values: {}, errors: {}, setErrors: vi.fn(), set: vi.fn(), text: vi.fn(), markSaved: mocks.saved, isSaved: () => false }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pause.mockReturnValue(mocks.resume);
});

describe("sign-up transition", () => {
  it.each(["pet", "human"])("loads approval status with a fresh document after %s signup", async (role) => {
    const submit = vi.fn().mockResolvedValue({ role, status: "pending_verification" });
    let finishNavigation!: () => void;
    const navigated = new Promise<void>((resolve) => { finishNavigation = resolve; });
    const replace = vi.fn(() => finishNavigation());
    vi.stubGlobal("window", { location: { replace } });
    const wizard = useSignUpWizard({ initial: {}, stepFields: [], validateStep: () => ({}), submit });
    let settled = false;
    void wizard.wizardProps.onFinish({} as HTMLFormElement).then(() => { settled = true; });
    await navigated;
    expect(mocks.pause).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
    expect(mocks.saved).toHaveBeenCalledOnce();
    expect(mocks.announce).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledExactlyOnceWith("/account-status");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.resume).not.toHaveBeenCalled();
    expect(settled).toBe(false);
  });

  it("resumes session checks and keeps the form open when signup fails", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("Network unavailable"));
    const replace = vi.fn();
    vi.stubGlobal("window", { location: { replace } });
    const wizard = useSignUpWizard({ initial: {}, stepFields: [], validateStep: () => ({}), submit });
    await wizard.wizardProps.onFinish({} as HTMLFormElement);
    expect(mocks.resume).toHaveBeenCalledOnce();
    expect(mocks.saved).not.toHaveBeenCalled();
    expect(mocks.announce).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(mocks.problem).toHaveBeenLastCalledWith("We couldn't create your account. Please try again.");
  });
});
