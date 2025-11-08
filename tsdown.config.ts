import { defineConfig } from "tsdown"

export default defineConfig({
    entry: ["src/cli/index.ts"],
    format: ["esm"],
    platform: "node",
    clean: true,
    shims: true,
    dts: false, // We're building a CLI, not a library
    outDir: "build",
    minify: false, // Keep readable for debugging, can enable for production
})
