import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      sourceType: "module",
      ecmaVersion: 2022,
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
    },
  },
  pluginJs.configs.recommended,
];