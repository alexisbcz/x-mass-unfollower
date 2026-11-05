import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from GitHub Pages at https://alexisbcz.github.io/x-mass-unfollower/
export default defineConfig({
  base: "/x-mass-unfollower/",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 },
});
