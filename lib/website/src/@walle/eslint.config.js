import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import markdown from "eslint-plugin-markdown";

export const baseConfig = {
  ignores: [
    "dist/**",
    "node_modules/**",
    ".astro/**",
    "public/**",
    ".husky/**",
    "src/content/**/*.md",
  ],
};

export const typescriptConfig = {
  files: ["src/**/*.ts", "src/**/*.tsx"],
  plugins: {
    "@typescript-eslint": ts,
  },
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      project: "./tsconfig.json",
    },
  },
  rules: {},
};

export const generalRulesConfig = {
  rules: {
    "no-unused-vars": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
};

export const markdownConfig = {
  files: ["src/**/*.md"],
  processor: markdown.processors.markdown,
};

export const eslintWalleConfigs = [
  baseConfig,
  ...eslintPluginAstro.configs.recommended,
  typescriptConfig,
  generalRulesConfig,
  ...markdown.configs.recommended,
  markdownConfig,
  eslintConfigPrettier,
];
