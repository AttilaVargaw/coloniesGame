import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            //reporter: ['text', 'text-summary'],

        },
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["e2e/**/*.spec.ts"]
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@engine": path.resolve(__dirname, "./src/engine"),
            "@game": path.resolve(__dirname, "./src/game"),
            "@lib": path.resolve(__dirname, "./src/lib"),
            "@components": path.resolve(__dirname, "./src/components"),
        },

    }
})