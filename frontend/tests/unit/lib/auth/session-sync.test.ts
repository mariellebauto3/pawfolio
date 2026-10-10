import { describe, expect, it } from "vitest";
import { sessionChange } from "@/lib/auth/session-sync";

describe("sessionChange: what another tab did to the session this page was rendered for", () => {
  it("is nothing while the same account, or nobody, is signed in", () => {
    expect(sessionChange(7, 7)).toBe("none");
    expect(sessionChange(null, null)).toBe("none");
  });

  it("tells signing in from signing out", () => {
    expect(sessionChange(null, 7)).toBe("signed-in");
    expect(sessionChange(7, null)).toBe("signed-out");
  });

  it("names another account on the session a switch, so the page of the first one is left", () => {
    expect(sessionChange(7, 12)).toBe("switched");
  });
});
