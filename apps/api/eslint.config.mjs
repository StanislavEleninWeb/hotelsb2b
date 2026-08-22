import { baseConfig } from "@hotel/config/eslint";

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // NestJS relies heavily on decorators + DI; these are noisy false positives.
      "@typescript-eslint/no-extraneous-class": "off",
    },
  },
];
