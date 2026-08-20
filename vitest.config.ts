import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
      "cloudflare:workers": fileURLToPath(new URL("./tests/cloudflare-workers-stub.ts", import.meta.url)),
    },
  },
  // The complete integration matrix exercises several deterministic fixture
  // transactions in parallel. Individual cases finish in a few seconds, but
  // Windows CI/desktop contention can push a 5s default over the line.
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 15_000 },
});
