import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { localTestClients } from "../scripts/local-test-clients.mjs";

const { administrator } = localTestClients();
const testPrefix = `E2E ${randomUUID()} `;

test("visitor identity survives reloads and tabs, names are optional, and another browser gets a different ID", async ({
  page,
  context,
  browser,
}) => {
  await page.goto("/");
  const nameField = page.getByRole("textbox", { name: "Name (optional)" });
  await expect(nameField).toHaveAttribute(
    "placeholder",
    /^Visitor #[0-9A-F]{8}$/,
  );
  const guestLabel = await nameField.getAttribute("placeholder");
  const guestMessage = `${testPrefix}An anonymous note with my browser identity.`;
  await page
    .getByRole("textbox", { name: "Leave a message" })
    .fill(guestMessage);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const guestRow = page.locator(".post-row").filter({ hasText: guestMessage });
  await expect(guestRow.getByRole("heading", { level: 3 })).toHaveText(
    guestLabel!,
  );
  const { data: guestPost } = await administrator
    .from("posts")
    .select("visitor_id, author_name")
    .eq("content", guestMessage)
    .single();
  expect(guestPost?.author_name).toBeNull();
  await page.reload();
  await expect(nameField).toHaveAttribute("placeholder", guestLabel!);
  const sameBrowserTab = await context.newPage();
  await sameBrowserTab.goto("/");
  await expect(
    sameBrowserTab.getByRole("textbox", { name: "Name (optional)" }),
  ).toHaveAttribute("placeholder", guestLabel!);
  await nameField.fill("Nadia Ali");
  await expect(
    sameBrowserTab.getByRole("textbox", { name: "Name (optional)" }),
  ).toHaveValue("Nadia Ali");
  const namedMessage = `${testPrefix}The same browser, now using my name.`;
  await page
    .getByRole("textbox", { name: "Leave a message" })
    .fill(namedMessage);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page
      .locator(".post-row")
      .filter({ hasText: namedMessage })
      .getByRole("heading", { level: 3 }),
  ).toHaveText("Nadia Ali");
  const { data: namedPost } = await administrator
    .from("posts")
    .select("visitor_id, author_name")
    .eq("content", namedMessage)
    .single();
  expect(namedPost?.visitor_id).toBe(guestPost?.visitor_id);
  await page.reload();
  await expect(nameField).toHaveValue("Nadia Ali");
  await nameField.fill("");
  const anotherGuestMessage = `${testPrefix}Back to my original visitor label.`;
  await page
    .getByRole("textbox", { name: "Leave a message" })
    .fill(anotherGuestMessage);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page
      .locator(".post-row")
      .filter({ hasText: anotherGuestMessage })
      .getByRole("heading", { level: 3 }),
  ).toHaveText(guestLabel!);
  const otherBrowser = await browser.newContext();
  try {
    const otherPage = await otherBrowser.newPage();
    await otherPage.goto("http://127.0.0.1:3000/");
    const otherName = otherPage.getByRole("textbox", {
      name: "Name (optional)",
    });
    await expect(otherName).toHaveAttribute(
      "placeholder",
      /^Visitor #[0-9A-F]{8}$/,
    );
    expect(await otherName.getAttribute("placeholder")).not.toBe(guestLabel);
  } finally {
    await otherBrowser.close();
  }
});

test("validates the optional name without losing the message", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Leave a message" })
    .fill(`${testPrefix}Keep this message while I fix my name.`);
  await page
    .getByRole("textbox", { name: "Name (optional)" })
    .fill("🌱".repeat(49));
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Use 48 characters or fewer for your name."),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Name (optional)" }).fill("");
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toBeEnabled();
});

test.afterEach(async () => {
  const { data: attachmentPosts } = await administrator
    .from("posts")
    .select("image_path")
    .like("content", `${testPrefix}%`)
    .not("image_path", "is", null);
  const attachmentPaths = (attachmentPosts ?? []).map(
    (post) => post.image_path as string,
  );
  if (attachmentPaths.length)
    await administrator.storage.from("wall-photos").remove(attachmentPaths);
  const { error } = await administrator
    .from("posts")
    .delete()
    .like("content", `${testPrefix}%`);
  if (error) throw new Error("Could not remove this run's owned test posts.");
});

test("anonymous Share, cross-context Realtime, refresh persistence, and no duplicates", async ({
  page,
  browser,
}) => {
  const observerContext = await browser.newContext();
  const observer = await observerContext.newPage();
  try {
    await Promise.all([
      page.goto("/"),
      observer.goto("http://127.0.0.1:3000/"),
    ]);
    await expect(
      observer.getByText("Loading messages…", { exact: true }),
    ).not.toBeVisible();
    const message = `${testPrefix}A real message, shared across two browsers.`;
    await page.getByRole("textbox", { name: "Leave a message" }).fill(message);
    await page.getByRole("button", { name: "Share", exact: true }).dblclick();
    await expect(
      page.locator(".post-message").filter({ hasText: message }),
    ).toHaveCount(1);
    await expect(
      observer.locator(".post-message").filter({ hasText: message }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("textbox", { name: "Leave a message" }),
    ).toHaveValue("");
    const { count } = await administrator
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("content", message);
    expect(count).toBe(1);
    await page.reload();
    await expect(
      page.locator(".post-message").filter({ hasText: message }),
    ).toBeVisible();
    expect(await observer.evaluate(() => Object.keys(localStorage))).toEqual([
      "mywall.visitor.v1",
    ]);
  } finally {
    await observerContext.close();
  }
});

test("validates whitespace and Unicode limits without truncating composition", async ({
  page,
}) => {
  await page.goto("/");
  const textarea = page.getByRole("textbox", { name: "Leave a message" });
  const share = page.getByRole("button", { name: "Share", exact: true });
  await expect(share).toBeDisabled();
  await textarea.fill(" \n\t\u00a0");
  await expect(share).toBeDisabled();
  await textarea.fill("🌱".repeat(280));
  await expect(page.locator("#character-count")).toHaveText("280 / 280");
  await expect(share).toBeEnabled();
  await textarea.fill("🌱".repeat(281));
  await expect(share).toBeDisabled();
  await expect(textarea).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("1 too many characters. Keep it to 280."),
  ).toBeVisible();
  await expect(textarea).toHaveValue("🌱".repeat(281));
});

test("preserves a failed draft and safely retries the real save", async ({
  page,
}) => {
  await page.goto("/");
  const message = `${testPrefix}Please keep this draft when the network fails.`;
  await page.getByRole("textbox", { name: "Leave a message" }).fill(message);
  await page.route("**/rest/v1/posts**", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Controlled unavailable response" }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.locator("#share-error")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Leave a message" }),
  ).toHaveValue(message);
  await page.unroute("**/rest/v1/posts**");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.locator(".post-message").filter({ hasText: message }),
  ).toBeVisible();
  const { count } = await administrator
    .from("posts")
    .select("id", { head: true, count: "exact" })
    .eq("content", message);
  expect(count).toBe(1);
});

test("a failed read is an error, then recovers when retried", async ({
  page,
}) => {
  await page.route("**/rest/v1/posts**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Controlled read failure" }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByText(
      "We couldn't load the wall. Check your connection and try again.",
    ),
  ).toBeVisible();
  await expect(page.getByText("No messages yet.")).not.toBeVisible();
  await page.unroute("**/rest/v1/posts**");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByText(
      "We couldn't load the wall. Check your connection and try again.",
    ),
  ).not.toBeVisible();
});

test("offline feedback preserves the draft and recovers without a reload", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByText("Loading messages…", { exact: true }),
  ).not.toBeVisible();
  const message = `${testPrefix}Keep this note while I reconnect.`;
  await page.getByRole("textbox", { name: "Leave a message" }).fill(message);
  await context.setOffline(true);
  await expect(page.locator(".connection-status")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Leave a message" }),
  ).toHaveValue(message);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.locator(".post-message").filter({ hasText: message }),
  ).toBeVisible();
});

test("scrolls only messages, loads 20 at a time, preserves the reading position, and returns to latest", async ({
  page,
}) => {
  const rows = Array.from({ length: 55 }, (_, index) => ({
    id: randomUUID(),
    content: `${testPrefix}Pagination message ${index}`,
    created_at: "2020-01-01T00:00:00Z",
  }));
  const { error } = await administrator.from("posts").insert(rows);
  expect(error).toBeNull();
  const { count } = await administrator
    .from("posts")
    .select("id", { count: "exact", head: true });
  await page.goto("/");
  const scroller = page.getByRole("region", {
    name: "Message history",
    exact: true,
  });
  await expect(page.locator(".post-row")).toHaveCount(20);
  await expect(
    page.getByRole("button", { name: "Back to latest" }),
  ).toHaveCount(0);
  await scroller.hover();
  await page.mouse.wheel(0, 700);
  await expect(
    page.getByRole("button", { name: "Back to latest" }),
  ).toBeVisible();
  const latestButton = await page
    .getByRole("button", { name: "Back to latest" })
    .boundingBox();
  const heading = await page.locator(".feed-heading").boundingBox();
  expect(
    Math.abs(
      latestButton!.x +
        latestButton!.width / 2 -
        heading!.x -
        heading!.width / 2,
    ),
  ).toBeLessThan(1);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const anchor = await page.locator(".post-row").evaluateAll((elements) => {
    const region = document
      .querySelector(".messages-scroll")!
      .getBoundingClientRect();
    const visible = elements.find(
      (element) => element.getBoundingClientRect().top >= region.top,
    );
    return {
      id: visible!.getAttribute("data-post-id"),
      top: visible!.getBoundingClientRect().top,
    };
  });
  const arrival = {
    content: `${testPrefix}New arrival while reading older messages.`,
  };
  const { error: arrivalError } = await administrator
    .from("posts")
    .insert(arrival);
  expect(arrivalError).toBeNull();
  await expect(page.locator(".post-row")).toHaveCount(21);
  const anchoredRow = page.locator(`[data-post-id="${anchor.id}"]`);
  expect(
    Math.abs((await anchoredRow.boundingBox())!.y - anchor.top),
  ).toBeLessThan(2);
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.locator(".post-row")).toHaveCount(41);
  let loadedCount = 41;
  while (loadedCount < count! + 1) {
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    loadedCount = Math.min(loadedCount + 20, count! + 1);
    await expect(page.locator(".post-row")).toHaveCount(loadedCount);
  }
  const actualIdentifiers = await page
    .locator(".post-row")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-post-id")),
    );
  const expectedIdentifiers: string[] = rows
    .map((row) => row.id)
    .sort()
    .reverse();
  expect(
    actualIdentifiers.filter((identifier) =>
      expectedIdentifiers.includes(identifier!),
    ),
  ).toEqual(expectedIdentifiers);
  await page.getByRole("button", { name: "Back to latest" }).click();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(0);
  await expect(
    page.getByText(arrival.content, { exact: true }),
  ).toBeInViewport();
  await expect(scroller).toBeFocused();
  expect(
    await page.evaluate(() => ({
      top: window.scrollY,
      height: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
    })),
  ).toEqual({ top: 0, height: 1000, viewport: 1000 });
});

test("keyboard posting and harmless HTML-like content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to the wall" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("textbox", { name: "Leave a message" }),
  ).toBeFocused();
  const message = `${testPrefix}<script>window.wallInjected=true</script>\nA harmless line of text.`;
  await page.keyboard.insertText(message);
  await page.keyboard.press("Control+Enter");
  await expect(
    page.locator(".post-message").filter({ hasText: message }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.hasOwn(window, "wallInjected"))).toBe(
    false,
  );
  await expect(
    page.getByRole("textbox", { name: "Leave a message" }),
  ).toBeFocused();
});

test("responsive layout, reduced motion, and automated accessibility", async ({
  page,
}) => {
  const { error } = await administrator.from("posts").insert({
    content: `${testPrefix}An actual persisted note for the accessibility checks.`,
  });
  expect(error).toBeNull();
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [600, 800],
    [667, 375],
    [768, 700],
    [1024, 640],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByText("Loading messages…", { exact: true }),
    ).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true);
    await expect(
      page.getByText("Full Stack Developer", { exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByText("Taguig City, Manila Philippines", { exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("region", { name: "Message history", exact: true }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "Share", exact: true }),
    ).toBeInViewport();
    await expect(page.getByText("Live", { exact: true })).toHaveCount(0);
    if (width === 390 || width === 1440) {
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        accessibility.violations.map((violation) => ({
          id: violation.id,
          elements: violation.nodes.map((node) => node.target),
        })),
      ).toEqual([]);
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("textbox", { name: "Leave a message" }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("region", { name: "Message history", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
});

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=",
  "base64",
);

test("a photo uploads, persists, and appears in an independent browser", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const message = `${testPrefix}A small photo shared through actual Supabase Storage.`;
  const encodedPhoto = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 900;
    const drawing = canvas.getContext("2d")!;
    drawing.fillStyle = "#46634c";
    drawing.fillRect(0, 0, 600, 900);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByRole("textbox", { name: "Leave a message" }).fill(message);
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "little-moment.png",
    mimeType: "image/png",
    buffer: Buffer.from(encodedPhoto, "base64"),
  });
  await expect(page.getByAltText("Selected photo preview")).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const photo = page
    .locator(".post-row")
    .filter({ hasText: message })
    .getByAltText("Photo shared with this message");
  await expect(photo).toBeVisible();
  await expect(photo).toHaveJSProperty("complete", true);
  expect(
    await photo.evaluate((element: HTMLImageElement) => element.naturalWidth),
  ).toBeGreaterThan(0);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const bounds = await photo.boundingBox();
    expect(bounds!.height).toBeLessThanOrEqual(128);
    expect(bounds!.width).toBeLessThanOrEqual(200);
  }
  const fullSize = photo.locator("..");
  await expect(fullSize).toHaveAttribute("target", "_blank");
  await expect(fullSize).toHaveAttribute(
    "href",
    /\/storage\/v1\/object\/public\/wall-photos\/posts\//,
  );
  await page.reload();
  await expect(photo).toBeVisible();
  const context = await browser.newContext();
  try {
    const observer = await context.newPage();
    await observer.goto("http://127.0.0.1:3000/");
    await expect(
      observer
        .locator(".post-row")
        .filter({ hasText: message })
        .getByAltText("Photo shared with this message"),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("photo validation, removal, and recoverable upload failure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(
    page.getByText(
      "That photo wasn't attached. Choose a JPG, PNG, WebP, or GIF image.",
    ),
  ).toBeVisible();
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "pretend-photo.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("This is a document, not an image."),
  });
  await expect(
    page.getByText(
      "That file isn't a valid photo. Choose a JPG, PNG, WebP, or GIF image.",
    ),
  ).toBeVisible();
  await expect(page.getByAltText("Selected photo preview")).toHaveCount(0);
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByText(
      "That photo wasn't attached. Choose an image smaller than 5 MiB.",
    ),
  ).toBeVisible();
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "small.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(page.getByAltText("Selected photo preview")).not.toBeVisible();
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "small.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  const message = `${testPrefix}Preserve my note if this upload fails.`;
  await page.getByRole("textbox", { name: "Leave a message" }).fill(message);
  await page.route("**/storage/v1/object/wall-photos/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Controlled upload failure" }),
    }),
  );
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByText(
      "We couldn't upload your photo. Your message is still here; please try again.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Leave a message" }),
  ).toHaveValue(message);
  await expect(page.getByAltText("Selected photo preview")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share", exact: true }),
  ).toBeInViewport();
  expect(
    await page
      .getByRole("region", { name: "Message history" })
      .evaluate((element) => element.clientHeight),
  ).toBeGreaterThan(24);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
});

test("a failed post save reuses its already-uploaded photo on retry", async ({
  page,
}) => {
  await page.goto("/");
  const message = `${testPrefix}Retry without uploading a second photo.`;
  let uploadRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/storage/v1/object/wall-photos/")
    )
      uploadRequests += 1;
  });
  await page.getByRole("textbox", { name: "Leave a message" }).fill(message);
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "retry.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page.route("**/rest/v1/posts**", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Controlled post failure" }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.locator("#share-error")).toBeVisible();
  await page.unroute("**/rest/v1/posts**");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.locator(".post-message").filter({ hasText: message }),
  ).toBeVisible();
  expect(uploadRequests).toBe(1);
});

test("accepts JPEG, PNG, WebP and GIF photos and rejects an unreadable raster file", async ({
  page,
}) => {
  await page.goto("/");
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    const encoded = await page.evaluate((type) => {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const drawing = canvas.getContext("2d")!;
      drawing.fillStyle = "#46634c";
      drawing.fillRect(0, 0, 16, 16);
      return canvas.toDataURL(type).split(",")[1];
    }, type);
    const name = `photo.${type.split("/")[1]}`;
    await page.getByLabel("Choose a photo").setInputFiles({
      name,
      mimeType: type,
      buffer: Buffer.from(encoded, "base64"),
    });
    await expect(page.locator(".attachment-preview")).toContainText(name);
    await expect(page.getByAltText("Selected photo preview")).toHaveJSProperty(
      "naturalWidth",
      16,
    );
    await page.getByRole("button", { name: "Remove photo" }).click();
  }
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "photo.gif",
    mimeType: "image/gif",
    buffer: Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64",
    ),
  });
  await expect(page.locator(".attachment-preview")).toContainText("photo.gif");
  await page.getByLabel("Choose a photo").setInputFiles({
    name: "damaged.png",
    mimeType: "image/png",
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0]),
  });
  await expect(
    page.getByText("That photo couldn't be opened. Choose another image."),
  ).toBeVisible();
  await expect(page.getByAltText("Selected photo preview")).toHaveCount(0);
});

test("older-message loading shows a visible error and safely retries the same page", async ({
  page,
}) => {
  const rows = Array.from({ length: 35 }, (_, index) => ({
    content: `${testPrefix}Older-page recovery ${index}`,
  }));
  const { error } = await administrator.from("posts").insert(rows);
  expect(error).toBeNull();
  await page.goto("/");
  await expect(page.locator(".post-row")).toHaveCount(20);
  const failedPageCursors = new Set<string | null>();
  await page.route("**/rest/v1/posts**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("or")) {
      failedPageCursors.add(
        new URL(route.request().url()).searchParams.get("or"),
      );
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Controlled older-page failure" }),
      });
    } else await route.continue();
  });
  const scroller = page.getByRole("region", { name: "Message history" });
  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const recovery = page.getByRole("main").getByRole("alert");
  await expect(recovery).toContainText(
    "We couldn't load older messages. Please try again.",
  );
  await expect(recovery).toBeInViewport();
  await expect(page.locator(".post-row")).toHaveCount(20);
  expect(failedPageCursors.size).toBe(1);
  await page.unroute("**/rest/v1/posts**");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".post-row")).toHaveCount(40);
  await expect(recovery).toHaveCount(0);
  const identifiers = await page
    .locator(".post-row")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-post-id")),
    );
  expect(new Set(identifiers).size).toBe(40);
});
