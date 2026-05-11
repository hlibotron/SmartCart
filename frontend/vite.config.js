import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/SmartCart/" : "/",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
}));
