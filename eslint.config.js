// Only the hooks rules: `tsc` covers the rest. Warnings, so they can be worked
// down without blocking anything.
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/", "docs/", "node_modules/", ".claude/", "data/", "test-results/"] },
  {
    files: ["src/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
