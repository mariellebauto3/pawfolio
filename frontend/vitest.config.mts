import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests (ADR 0003). Plain Node environment: browser APIs a test needs are stubbed in the test itself.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
