import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "node_modules"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: { react },
    rules: {
      // An unused binding is an error, capitalised names included: no ignore pattern.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      // A component used in JSX but never imported is a crash at render.
      "react/jsx-no-undef": "error",
      // Lets no-unused-vars see a binding that is only ever used as a JSX tag.
      "react/jsx-uses-vars": "error",
    },
  },
  {
    // The entry file exports nothing by design; Fast Refresh does not apply to it.
    files: ["src/main.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["scripts/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
]);
