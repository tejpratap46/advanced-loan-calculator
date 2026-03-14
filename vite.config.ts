import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite"; // ← add this

export default defineConfig({
  plugins: [
    tailwindcss(), // ← add this BEFORE cloudflare()
    react(),
    cloudflare(),
  ],
});