import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import { resolve } from "node:path";

// Dev: `vite` serves the demo harness (index.html + src/dev).
// Build: library mode, Vue kept external so consumers provide their own.
export default defineConfig({
  plugins: [
    vue(),
    // Emits one .d.ts per source file into dist/, mirroring src/index.ts's
    // exports — scoped to `src` minus `src/dev`, so the dev harness's types
    // never leak into the published package. (Not rollupTypes: true — that
    // option goes through @microsoft/api-extractor, which silently drops
    // declarations for .vue SFCs, breaking AnnotatorView/AnnotatorQueue's
    // published types entirely.)
    dts({
      include: ["src"],
      exclude: ["src/dev/**"],
      tsconfigPath: resolve(__dirname, "tsconfig.json"),
      // Its own .vue auto-detection only checks include-glob strings for a
      // literal ".vue" substring plus a shallow root-dir scan — neither
      // reaches src/components/*.vue, so it silently (no warning) falls back
      // to the plain "ts" processor and drops every component's types.
      processor: "vue",
    }),
  ],
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
