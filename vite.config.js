import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    lib: {
      name: "fuzzysort",
      entry: "./src/fuzzysort.ts",
      formats: ["es", "umd"],
    },
    sourcemap: true,
  },
});
