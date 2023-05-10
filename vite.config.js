import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    lib: {
      name: "fuzzysort",
      entry: "./src/fuzzysort.js",
      formats: ["es", "umd"],
    },
    sourcemap: true,
  },
});
