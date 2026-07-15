/// <reference types="vitest/config" />
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    // Playwright owns e2e/ — Vitest's default include would otherwise try to
    // run those specs in jsdom, where `test` resolves to the wrong runner.
    exclude: ["node_modules/**", "dist/**", "e2e/**"],
  },
});
