import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Landing page build. Output goes to src/web/dist (served at the domain root
// https://app.aevrin.net/; the product dashboard lives under /dashboard/).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
