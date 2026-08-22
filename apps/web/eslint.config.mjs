import { baseConfig } from "@hotel/config/eslint";

// eslint-config-next is CJS; loaded via FlatCompat-free direct import works in v15.
export default [
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
];
