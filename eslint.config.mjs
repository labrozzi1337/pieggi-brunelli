import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/coverage/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["apps/frontend/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"], reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    }
  },
  {
    files: ["apps/backend/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      "@next/next/no-html-link-for-pages": "off"
    },
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    }
  },
  {
    files: ["**/*.config.{js,mjs,ts}"],
    extends: [tseslint.configs.disableTypeChecked]
  }
);

