import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "apps/backend/src") }
  },
  test: {
    include: ["apps/**/*.test.ts"],
    environment: "node"
  }
});
