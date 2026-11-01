import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
