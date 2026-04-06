import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash]-v4.js`,
        chunkFileNames: `assets/[name]-[hash]-v4.js`,
        assetFileNames: `assets/[name]-[hash]-v4.[ext]`,
      },
    },
  },
});
