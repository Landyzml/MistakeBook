import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Hash routing works on both GitHub Pages project paths and local previews.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === "true" ? "/MistakeBook/" : "/",
});
