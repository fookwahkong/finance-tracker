import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{js,jsx}"],
    setupFiles: ["./src/setupTests.js"],
    // These VITE_ vars are configured in prod (Vercel env) but absent in CI,
    // where there is no .env file. Without them createClient() throws
    // "supabaseUrl is required" at import and the demo hint won't render.
    // Provide deterministic test values so tests don't depend on a local .env.
    env: {
      VITE_SUPABASE_URL: "https://demo.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
      VITE_DEMO_EMAIL: "demo@example.com",
      VITE_DEMO_PASSWORD: "demo",
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
