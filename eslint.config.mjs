// @ts-check
import eslint from "@eslint/js"
import tsEslint from "typescript-eslint"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"

export default tsEslint.config(
    // ESLint recommended rules
    eslint.configs.recommended,

    // TypeScript ESLint recommended rules
    // Known type incompatibility between ESLint 9 and typescript-eslint
    ...tsEslint.configs.recommended,

    // Prettier integration (must be last to override other configs)
    eslintPluginPrettierRecommended,

    // Project-specific overrides
    {
        rules: {
            // TypeScript specific overrides
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
        },
    },

    {
        ignores: ["dist/**", "node_modules/**", "*.js", "*.mjs", "*.cjs"],
    }
)
