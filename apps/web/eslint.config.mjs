import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
// import globals from "globals"; // Not needed for this change

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Add explicit React settings to help plugins like react-hooks
  {
    files: ["**/*.{js,jsx,ts,tsx}"], // Common glob for React/Next.js projects
    settings: {
      react: {
        version: "detect", // Automatically detect the React version
      },
    },
  },
];

export default eslintConfig;
