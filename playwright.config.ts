import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "*.spec.ts",
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173",
    launchOptions: {
      executablePath:
        "/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev",
    },
    viewport: { width: 1440, height: 1000 },
  },
  reporter: "list",
});
