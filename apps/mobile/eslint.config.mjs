import { baseConfig } from "@hotel/config/eslint";

export default [
  { ignores: ["**/.expo/**", "babel.config.js", "metro.config.js"] },
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
];
