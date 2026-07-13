import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// "@shared" resolves only inside the Vite app (src/).
// Serverless functions in api/ are bundled separately by Vercel and must
// use relative imports (../shared/...) instead.
export default defineConfig(({ mode }) => {
  // VITE_ vars are baked in at build time. If they're absent the app dies
  // with a blank white screen at runtime — fail the build instead, so a
  // misconfigured deploy is caught on Vercel's side, not by users.
  if (mode === "production") {
    const env = loadEnv(mode, process.cwd(), "");
    for (const key of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) {
      if (!env[key]) {
        throw new Error(`${key} must be set at build time (Vercel project env vars, or .env.local locally).`);
      }
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@shared": path.resolve(__dirname, "shared"),
      },
    },
  };
});
