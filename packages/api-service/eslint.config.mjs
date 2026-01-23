import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-empty": "off",
    },
  },
];
