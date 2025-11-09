import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/**/__tests__/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: [
                "src/cli/**", // CLI UI code - low priority for now
                "**/__tests__/**",
                "**/node_modules/**",
                "build/**",
            ],
        },
        // Cleanup temp files after each test
        setupFiles: ["./src/__tests__/helpers/setup.ts"],
    },
    resolve: {
        alias: {
            "@/core": path.resolve(__dirname, "./src/core"),
            "@/cli": path.resolve(__dirname, "./src/cli"),
            "@/types": path.resolve(__dirname, "./src/core/types"),
            "@/enums": path.resolve(__dirname, "./src/core/enums"),
            "@/__tests__": path.resolve(__dirname, "./src/__tests__"),
        },
    },
})
