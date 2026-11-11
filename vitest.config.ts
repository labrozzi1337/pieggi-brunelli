import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(import.meta.dirname, "apps/backend/src") };

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    projects: [
      { resolve: { alias }, test: { name: "unidade", include: ["apps/**/*.test.ts"], exclude: ["apps/**/*.banco.test.ts", "**/node_modules/**"], environment: "node" } },
      // Integração com Postgres real descartável: rode com `npm run test:banco`.
      { resolve: { alias }, test: { name: "banco", include: ["apps/**/*.banco.test.ts"], environment: "node", fileParallelism: false, testTimeout: 30000 } }
    ]
  }
});
