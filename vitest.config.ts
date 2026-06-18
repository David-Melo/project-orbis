import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // happy-dom gives us localStorage for the persistence + store tests.
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
  },
});
