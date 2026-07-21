import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginAstro from "eslint-plugin-astro";
import markdown from "eslint-plugin-markdown";

export const baseConfig = {
  // Use **/ so generated output is ignored at any depth (e.g. inside e2e sandboxes).
  ignores: [
    "**/dist/**",
    "**/node_modules/**",
    "**/.astro/**",
    "**/.yarn/**",
    "**/public/**",
    "**/.husky/**",
    "**/src/content/**/*.md",
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
    // Allow underscore-prefixed identifiers as intentional throwaways.
    "no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
    ],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
};

// @walle CLI/tooling scripts are Node programs that print to stdout by design.
export const walleScriptsConfig = {
  files: ["scripts/@walle/**/*.{js,mjs,cjs}"],
  rules: {
    "no-console": "off",
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
  walleScriptsConfig,
  ...markdown.configs.recommended,
  markdownConfig,
  eslintConfigPrettier,
];
