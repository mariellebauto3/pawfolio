import { describe, expect, it } from "vitest";
import { shellAreaFor } from "@/lib/auth/shell-area";
import type { Account } from "@/types/account";

const account = (role: Account["role"], status: Account["status"] = "active"): Account => ({
  id: 1,
  role,
  status,
  email: "someone@example.com",
  display_name: "Someone",
  avatar_url: null,
  profile_id: null,
});

describe("shellAreaFor", () => {
  it("puts visitors in the guest shell", () => {
    expect(shellAreaFor(null)).toBe("guest");
  });

  it("puts active pets and humans in the member shell, and admins in the admin shell", () => {
    expect(shellAreaFor(account("pet"))).toBe("member");
    expect(shellAreaFor(account("human"))).toBe("member");
    expect(shellAreaFor(account("admin"))).toBe("admin");
  });

  it.each(["pending_verification", "denied", "suspended", "deactivated"] as const)(
    "puts %s accounts in the account-status shell, whatever their role",
    (status) => {
      expect(shellAreaFor(account("pet", status))).toBe("account-status");
      expect(shellAreaFor(account("admin", status))).toBe("account-status");
    },
  );
});
