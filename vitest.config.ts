import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests import mobile/src files; don't let esbuild read mobile/tsconfig.json (it extends expo, which
  // isn't installed at the repo root).
  esbuild: { tsconfigRaw: "{}" },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
