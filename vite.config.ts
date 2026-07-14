import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

// Dev: `vite` serves the demo harness (index.html + src/dev).
// Build: library mode, Vue kept external so consumers provide their own.
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "LegalAnnotationKit",
      fileName: "legal-annotation-kit",
    },
    rollupOptions: {
      external: ["vue"],
      output: { globals: { vue: "Vue" } },
    },
  },
});
