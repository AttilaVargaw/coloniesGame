import path from 'path'
import { defineConfig } from 'vitest/config'

const dirname = import.meta.dirname

export default defineConfig({
	test: {
		maxForks: 8,
		coverage: {
			provider: 'v8',
			//reporter: ['text', 'text-summary'],

		},
		include: ["src/**/*.{test,spec}.{ts,tsx}"],
		exclude: ["e2e/**/*.spec.ts"]
	},
    resolve: {
        alias: {
            "@": path.resolve(dirname, "./src"),
            "@engine": path.resolve(dirname, "./src/engine"),
            "@game": path.resolve(dirname, "./src/game"),
            "@lib": path.resolve(dirname, "./src/lib"),
            "@components": path.resolve(dirname, "./src/components"),
        },

    }
})