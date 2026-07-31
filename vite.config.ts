import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Keep onnxruntime-node out of the browser bundle (Transformers.js).
      "onnxruntime-node": path.resolve(
        rootDir,
        "src/lib/rmbg/empty-module.js",
      ),
    },
  },
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
});
