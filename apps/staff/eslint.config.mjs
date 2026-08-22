import { baseConfig } from "@hotel/config/eslint";

export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
];
