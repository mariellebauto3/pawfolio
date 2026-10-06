import { describe, expect, it, vi } from "vitest";
import { renderAccount } from "@/lib/auth/render-account";

// The real cache() only memoizes inside a React render; identity here keeps each test's call honest about what it
// asks the API.
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));

// next/headers only works inside a request; the tests stand in for the incoming Cookie header.
const request = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => request.cookie }) }));

const account = { id: 5, role: "human", status: "pending_verification", email: "ana.santos@example.com" };

function stubApi(response: () => Promise<Response>) {
  const fetchMock = vi.fn(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("renderAccount", () => {
  it("answers for a visitor with no session cookie without asking the API", async () => {
    const fetchMock = stubApi(async () => new Response(null, { status: 500 }));
    request.cookie = "XSRF-TOKEN=abc";

    await expect(renderAccount()).resolves.toEqual({ ok: true, account: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries the account to every caller of this render", async () => {
    stubApi(async () => Response.json({ data: account }));
    request.cookie = "pawfolio-session=s1; XSRF-TOKEN=abc";

    await expect(renderAccount()).resolves.toEqual({ ok: true, account });
  });

  it("reports a session that has ended as signed out, not as a failure", async () => {
    stubApi(async () => Response.json({ message: "Unauthenticated." }, { status: 401 }));
    request.cookie = "pawfolio-session=old";

    await expect(renderAccount()).resolves.toEqual({ ok: true, account: null });
  });

  it("hands the failure to the caller instead of swallowing it, so a page can show the error screen", async () => {
    stubApi(async () => Response.json({ message: "Down" }, { status: 503 }));
    request.cookie = "pawfolio-session=s1";

    const result = await renderAccount();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(Error);
  });

  it("treats a payload that isn't an account as a failure rather than trusting it", async () => {
    stubApi(async () => Response.json({ data: { id: 5, role: "wizard", status: "pending_verification" } }));
    request.cookie = "pawfolio-session=s1";

    const result = await renderAccount();
    expect(result.ok).toBe(false);
  });
});
