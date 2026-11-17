import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The browser only ever talks to this one origin; /api is passed through to the pgo backend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5573,
    host: true,
    proxy: { "/api": { target: "http://localhost:4100", changeOrigin: false, timeout: 600000, proxyTimeout: 600000 } },
  },
});
