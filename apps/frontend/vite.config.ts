import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
  // Mesma origem em dev, como o nginx faz em produção: sem CORS, funciona por localhost, 127.0.0.1 ou IP da rede.
  server: { proxy: { "/api": { target: process.env.PIEGGI_BACKEND_URL ?? "http://127.0.0.1:3000" } } }
});

