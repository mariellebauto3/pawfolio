import { describe, expect, it, vi } from "vitest";
import { lookUpAccount } from "@/lib/auth/lookup-account";

const account = { id: 2, role: "human", status: "active", email: "ana.santos@example.com" };

function stubApi(response: () => Promise<Response>) {
  const fetchMock = vi.fn(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("lookUpAccount", () => {
  it("skips the API when there is no session cookie", async () => {
    const fetchMock = stubApi(async () => new Response(null, { status: 500 }));
    await expect(lookUpAccount(null)).resolves.toBeNull();
    await expect(lookUpAccount("XSRF-TOKEN=abc")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks /auth/me with the visitor's cookies", async () => {
    const fetchMock = stubApi(async () => Response.json({ data: account }));
    await expect(lookUpAccount("pawfolio-session=s1; XSRF-TOKEN=abc")).resolves.toEqual(account);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/auth\/me$/);
    expect(new Headers(init.headers).get("cookie")).toBe("pawfolio-session=s1; XSRF-TOKEN=abc");
  });

  it("resolves to null when the session has ended", async () => {
    stubApi(async () => Response.json({ message: "Unauthenticated." }, { status: 401 }));
    await expect(lookUpAccount("pawfolio-session=old")).resolves.toBeNull();
  });

  it("resolves to undefined, never throws, when the API can't answer", async () => {
    stubApi(async () => Response.json({ message: "Down" }, { status: 503 }));
    await expect(lookUpAccount("pawfolio-session=s1")).resolves.toBeUndefined();
    stubApi(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(lookUpAccount("pawfolio-session=s1")).resolves.toBeUndefined();
  });
});
