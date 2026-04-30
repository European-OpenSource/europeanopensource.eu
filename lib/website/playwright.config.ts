import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:4321",
  },
  webServer: {
    command: "just dev",
    url: "http://localhost:4321",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
