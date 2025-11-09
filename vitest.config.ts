import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
    plugins: [tsconfigPaths()],
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
})
