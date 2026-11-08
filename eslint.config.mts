import eslintReact from "@eslint-react/eslint-plugin";
import eslintJs from "@eslint/js";
import { defineConfig } from "eslint/config";
import oxlint from "eslint-plugin-oxlint";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "src-tauri",
      "coverage",
      "dist",
      "e2e",
      ".kilo",
      "playwright.config.ts",
      "vitest.config.ts",
    ],
    extends: [
      eslintJs.configs.recommended,
      tseslint.configs.recommended,
      eslintconfigs["recommended-typescript"],
      oxlint.configs["flat/recommended"],
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          "argsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@eslint-react/use-state": "off",
    },
  },
);