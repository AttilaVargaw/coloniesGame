import { defineConfig } from "vitest/config";
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import path from "path";
import babel from '@rolldown/plugin-babel';

const dirname = import.meta.dirname
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), babel({
    presets: [reactCompilerPreset()]
  })],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "@engine": path.resolve(dirname, "./src/engine"),
      "@game": path.resolve(dirname, "./src/game"),
      "@lib": path.resolve(dirname, "./src/lib"),
      "@components": path.resolve(dirname, "./src/components"),
    },
  },
  oxc: {
    target: "es2022",
    decorators: true
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/game.test.ts"],
  },
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
