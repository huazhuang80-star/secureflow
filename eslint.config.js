import js from "@eslint/js";
import globals from "globals";
import reactDOM from "eslint-plugin-react-dom";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactX from "eslint-plugin-react-x";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
  globalIgnores([
    "dist",
    "packages",
    "backend/**",
    "src/contracts/generated/**",
    "src/contracts/*",
    "!src/contracts/util.ts",
  ]),
  {
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactDOM.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
      reactX.configs["recommended-typescript"],
      prettier,
    ],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRoot: import.meta.dirname,
      },
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
      // These rules are tracked as improvement issues
      "no-empty": "warn",
      "no-case-declarations": "warn",
      "no-useless-catch": "warn",
      "no-dupe-else-if": "warn",
      "prefer-const": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "react-x/no-nested-component-definitions": "warn",
      // Type-aware rules — warn only, tracked in open issues
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
      "@typescript-eslint/no-floating-promises": "warn",
      "@typescript-eslint/await-thenable": "warn",
      "@typescript-eslint/no-base-to-string": "warn",
      "@typescript-eslint/restrict-plus-operands": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/unbound-method": "warn",
    },
  }
);
