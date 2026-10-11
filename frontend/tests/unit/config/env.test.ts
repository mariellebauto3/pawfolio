import { describe, expect, it } from "vitest";
import { parseEnv } from "@/config/env";

describe("parseEnv", () => {
  it("defaults to the local Laravel and Next.js servers", () => {
    expect(parseEnv({ NODE_ENV: "development" })).toEqual({
      apiUrl: "http://localhost:8000",
      appUrl: "http://localhost:3000",
      apiMode: "live",
    });
  });

  it("keeps only the origin, without a trailing slash", () => {
    const env = parseEnv({ NEXT_PUBLIC_API_URL: "https://api.pawfolio.example/", NODE_ENV: "production" });
    expect(env.apiUrl).toBe("https://api.pawfolio.example");
  });

  it("turns mock mode on in development only", () => {
    expect(parseEnv({ NEXT_PUBLIC_API_MODE: "mock", NODE_ENV: "development" }).apiMode).toBe("mock");
    expect(parseEnv({ NEXT_PUBLIC_API_MODE: "mock", NODE_ENV: "test" }).apiMode).toBe("mock");
    expect(parseEnv({ NEXT_PUBLIC_API_MODE: "mock", NODE_ENV: "production" }).apiMode).toBe("live");
    expect(parseEnv({ NEXT_PUBLIC_API_MODE: "anything", NODE_ENV: "development" }).apiMode).toBe("live");
  });

  it("rejects values that aren't http(s) URLs", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_API_URL: "localhost:8000" })).toThrow(/NEXT_PUBLIC_API_URL/);
    expect(() => parseEnv({ NEXT_PUBLIC_API_URL: "ftp://files.example" })).toThrow(/http or https/);
  });

  it("requires https in production except for local hosts", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_API_URL: "http://api.pawfolio.example", NODE_ENV: "production" })).toThrow(
      /https in production/,
    );
    expect(parseEnv({ NEXT_PUBLIC_API_URL: "http://127.0.0.1:8000", NODE_ENV: "production" }).apiUrl).toBe(
      "http://127.0.0.1:8000",
    );
  });
});
