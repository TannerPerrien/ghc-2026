import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      "@data": path.resolve(import.meta.dirname, "../data"),
    },
    // @ts-ignore — reactRouter plugin handles tsconfig paths
    tsconfigPaths: true,
  },
});
