import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const outputDirectory = "docs/screenshots";
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
  { name: "small-phone", width: 320, height: 568 },
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const { name, width, height } of viewports) {
    const context = await browser.newContext({
      viewport: { width, height },
      timezoneId: "Asia/Manila",
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:3000");
      await expect(
        page.getByText("Loading messages…", { exact: true }),
      ).toHaveCount(0);
      await expect(page.locator(".read-error")).toHaveCount(0);
      await page.screenshot({ path: `${outputDirectory}/compact-${name}.png` });
    } finally {
      await context.close();
    }
  }
  console.log(
    "Saved desktop and phone captures of the existing wall. No messages were created.",
  );
} finally {
  await browser.close();
}
