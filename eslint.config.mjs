import js from '@eslint/js'
import ts from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import tailwindcss from 'eslint-plugin-tailwindcss'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': ts,
      react: react,
      'react-hooks': reactHooks,
      tailwindcss,
    },
    rules: {
      ...ts.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...tailwindcss.configs.recommended.rules,

      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      'tailwindcss/no-custom-classname': 'off',
      "@typescript-eslint/no-unsafe-function-type": "warn"
    },
    settings: {
      tailwindcss: {
        cssConfigPath: './src/App.css',
        callees: ['cn', 'clsx'],
      },
      react: { version: 'detect' },
    },
  },
  {
    ignores: ['dist/**', '.vite/**', 'src-tauri/**', 'coverage/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
  },
]
