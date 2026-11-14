import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseUrl = "http://127.0.0.1:3000";
const outputDirectory = "docs/screenshots";
const notes = [
  "Hello, wall! A real message, saved and shared. Glad to have a little corner of the internet back. 👋",
  "A small reminder for today: step away from the screen, get some fresh air, and come back with a clearer mind. 🌿",
  "One wall, a few passing thoughts, and room for the next hello.",
];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    timezoneId: "Asia/Manila",
    reducedMotion: "reduce",
  });
  const page = await desktop.newPage();
  await page.goto(baseUrl);
  await page.getByRole("heading", { name: "Messages", exact: true }).waitFor();
  await page
    .getByText("Loading messages…", { exact: true })
    .waitFor({ state: "hidden" });
  for (const note of notes) {
    if (await page.getByText(note, { exact: true }).count()) continue;
    await page.getByRole("textbox", { name: "Leave a message" }).fill(note);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.getByText(note, { exact: true }).waitFor();
  }
  await page.reload();
  await page.getByText(notes.at(-1), { exact: true }).waitFor();
  await page.screenshot({
    path: `${outputDirectory}/desktop.png`,
    fullPage: true,
  });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    timezoneId: "Asia/Manila",
    reducedMotion: "reduce",
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(baseUrl);
  await mobilePage.getByText(notes.at(-1), { exact: true }).waitFor();
  await mobilePage.screenshot({
    path: `${outputDirectory}/mobile.png`,
    fullPage: true,
  });
  console.log(
    "Saved real desktop and mobile captures after posting and reloading. The three Visitor notes remain in local Supabase as review examples.",
  );
} finally {
  await browser.close();
}
