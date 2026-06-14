import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built bundle can also be opened from a static host / file path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5173, open: true },
});
