import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, lazyPlugins } from "vite-plus"

const server = process.env.SHOP_SERVER_URL ?? "http://127.0.0.1:3000"

export default defineConfig({
    lint: {
        plugins: ["oxc", "typescript", "unicorn", "react"],
        categories: {
            correctness: "error",
        },
        env: {
            builtin: true,
            browser: true,
        },
        ignorePatterns: ["dist"],
        rules: {
            curly: ["error", "all"],
            "react/only-export-components": "off",
        },
        overrides: [
            {
                files: ["**/*.test.ts"],
                rules: {
                    "typescript/await-thenable": "off",
                    "typescript/no-misused-spread": "off",
                },
            },
        ],
        options: {
            typeAware: true,
            typeCheck: true,
        },
    },
    fmt: {
        endOfLine: "lf",
        semi: false,
        singleQuote: false,
        tabWidth: 4,
        trailingComma: "es5",
        printWidth: 100,
        sortPackageJson: false,
        overrides: [
            {
                files: ["*.json", "*.yml", "*.yaml", "*.md"],
                options: {
                    tabWidth: 2,
                },
            },
        ],
        ignorePatterns: ["dist/", "node_modules/", "bun.lock", "*.md"],
    },
    plugins: lazyPlugins(() => [react(), tailwindcss()]),
    resolve: {
        alias: {
            "@": resolve(import.meta.dirname, "./client"),
        },
    },
    server: {
        port: 5174,
        proxy: { "/api": server },
    },
})
