import path from "node:path";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { PinterestClient } from "pinterest-js-client";
import type { Page, Locator } from "playwright";
import type { ContentPlanDocument } from "./types";
import { config } from "../config";
import {
  downloadMedia,
  removeFile,
  getScreenshotPath,
  getTempDir,
  delay,
  randomBetween,
  randomDelay,
  humanTypeLocator,
} from "./utils";

export interface PublishResult {
  success: boolean;
  pinUrl: string | null;
  screenshotPath?: string;
  captchaDetected?: boolean;
}

const COOKIES_PATH = path.resolve("cookies.json");

/* ── cookie loading ────────────────────────────────────────── */

function loadCookies(): any[] {
  if (existsSync(COOKIES_PATH)) {
    try {
      const cookies = JSON.parse(readFileSync(COOKIES_PATH, "utf-8"));
      if (Array.isArray(cookies) && cookies.length > 0) {
        console.log(`[pinterest] loaded ${cookies.length} cookies from cookies.json`);
        return cookies;
      }
    } catch (e) {
      console.warn("[pinterest] could not load cookies.json:", e);
    }
  }
  const authPath = config.poster.authStatePath();
  try {
    const raw = readFileSync(authPath, "utf-8");
    const state = JSON.parse(raw);
    if (Array.isArray(state.cookies)) {
      console.log(`[pinterest] loaded ${state.cookies.length} cookies from ${authPath}`);
      return state.cookies;
    }
  } catch (e) {
    console.warn(`[pinterest] could not load cookies from ${authPath}:`, e);
  }
  return [];
}

/* ── Pinterest selectors (Russian locale) ──────────────────── */

const TITLE_SELECTORS = [
  'input[placeholder*="заголовок"]',
  'input[placeholder*="Заголовок"]',
  'input[placeholder*="название"]',
  'input[placeholder*="Название"]',
  'input[placeholder*="title" i]',
  'textarea[placeholder*="заголовок"]',
  'textarea[placeholder*="Заголовок"]',
  'textarea[placeholder*="название"]',
  'textarea[placeholder*="title" i]',
  'textarea[id^="pin-draft-title"]',
  'textarea#pinTitle',
  'input[type="text"]',
] as const;

const LINK_SELECTORS = [
  'input[placeholder*="целевую ссылку"]',
  'input[placeholder*="ссылку"]',
  'input[placeholder*="Ссылка"]',
  'input[placeholder*="link" i]',
  'input[placeholder*="URL" i]',
  'textarea[placeholder*="целевую ссылку"]',
  'textarea[placeholder*="link" i]',
  'textarea[id^="pin-draft-link"]',
  'input[type="url"]',
  'input[type="text"]',
] as const;

const DESC_SELECTORS = [
  'textarea[placeholder*="description" i]',
  'textarea[placeholder*="Расскажите"]',
  'textarea[placeholder*="Описание"]',
  'textarea[placeholder*="описание"]',
  'div[role="textbox"][aria-label*="description" i]',
  'div[role="textbox"][aria-label*="Описание"]',
] as const;

const BOARD_TRIGGER_SELECTORS = [
  '[data-test-id="board-dropdown-select-button"]',
  '[data-test-id="board-selector"]',
  'div[data-test-id="board-dropdown"]',
] as const;

const PUBLISH_SELECTORS = [
  '[data-test-id="board-dropdown-save-button"]',
  'button[data-test-id="publish-button"]',
  'button:has-text("Опубликовать")',
  'button:has-text("Сохранить")',
  'button:has-text("Publish")',
  'button:has-text("Save")',
  'div[data-test-id="circle-publish-button"] button',
] as const;

const FILE_INPUT_SELECTORS = [
  'input[type="file"][data-test-id^="media-upload-input"]',
  'input[type="file"][data-test-id="media-upload-input"]',
  'input[type="file"]',
] as const;

/* ── helper: first matching visible locator ────────────────── */

async function firstVisible(
  page: Page,
  selectors: readonly string[],
  timeout = 8000
): Promise<Locator> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        const loc = page.locator(sel).first();
        if ((await loc.count()) > 0) {
          const visible = await loc.isVisible().catch(() => false);
          if (visible) return loc;
        }
      } catch {
        /* skip */
      }
    }
    await delay(500);
  }
  // last resort: return first matching regardless of visibility
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) return loc;
  }
  throw new Error(`No element found for selectors: ${selectors.join(", ")}`);
}

/* ── core logic ────────────────────────────────────────────── */

function buildClient(): PinterestClient {
  const cookies = loadCookies();
  const proxyServer = config.poster.proxyServer();
  return new PinterestClient({
    headless: config.poster.headless(),
    useFingerprintSuite: true,
    slowMo: 30,
    timeout: 60000,
    viewport: {
      width: config.poster.viewportWidth(),
      height: config.poster.viewportHeight(),
    },
    cookies,
    proxy: proxyServer
      ? {
          server: proxyServer,
          username: config.poster.proxyUsername() || undefined,
          password: config.poster.proxyPassword() || undefined,
        }
      : undefined,
    disableFileCookies: true,
    logLevel: "debug" as any,
  });
}

async function fillTitle(page: Page, title: string): Promise<void> {
  const loc = await firstVisible(page, TITLE_SELECTORS, 15000);
  await loc.scrollIntoViewIfNeeded();
  await randomDelay(300, 700);
  await loc.click();
  await delay(randomBetween(200, 500));
  await loc.fill("");
  await delay(randomBetween(150, 400));
  for (const char of title) {
    await loc.press(char, { delay: randomBetween(30, 100) });
  }
  await delay(randomBetween(300, 800));
}

async function fillDescription(page: Page, desc: string): Promise<void> {
  try {
    const loc = await firstVisible(page, DESC_SELECTORS, 8000);
    await loc.scrollIntoViewIfNeeded();
    await randomDelay(300, 600);
    await loc.click();
    await delay(randomBetween(200, 400));
    // Try fill first, fallback to keyboard
    const tag = await loc.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
    if (tag === "textarea" || tag.startsWith("input")) {
      await loc.fill("");
      await delay(randomBetween(150, 300));
      for (const char of desc) {
        await loc.press(char, { delay: randomBetween(20, 80) });
      }
    } else {
      await loc.press("Control+A");
      await loc.press("Backspace");
      await delay(randomBetween(150, 300));
      for (const char of desc) {
        await loc.press(char, { delay: randomBetween(20, 80) });
      }
    }
  } catch {
    // Fallback: Tab from title field into description
    console.warn("[pinterest] description field not found, using Tab fallback");
    await page.keyboard.press("Tab");
    await delay(randomBetween(300, 600));
    await page.keyboard.type(desc, { delay: 30 });
  }
  await delay(randomBetween(300, 800));
}

async function fillLink(page: Page, link: string): Promise<void> {
  const loc = await firstVisible(page, LINK_SELECTORS, 10000);
  await loc.scrollIntoViewIfNeeded();
  await randomDelay(300, 700);
  await loc.click();
  await delay(randomBetween(200, 500));
  await loc.fill("");
  await delay(randomBetween(150, 400));
  for (const char of link) {
    await loc.press(char, { delay: randomBetween(20, 80) });
  }
  await delay(randomBetween(300, 800));
}

async function selectBoard(page: Page, boardName?: string): Promise<void> {
  if (!boardName) return;
  try {
    const trigger = await firstVisible(page, BOARD_TRIGGER_SELECTORS, 10000);
    const visible = await trigger.isVisible().catch(() => false);
    if (!visible) {
      console.warn("[pinterest] board trigger not found, skipping");
      return;
    }
    await trigger.scrollIntoViewIfNeeded();
    await randomDelay(500, 1200);
    await trigger.click();
    await delay(randomBetween(1000, 2000));

    // Try to find the board by name
    const boardRow = page.locator(`[data-test-id="board-row-${boardName}"] button`).first();
    if ((await boardRow.count()) > 0) {
      await boardRow.click();
      await delay(randomBetween(1000, 2000));
      return;
    }

    // Fallback: search for board
    const searchInput = page.locator('#pickerSearchField, input[placeholder*="поиск" i], input[placeholder*="search" i]').first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill(boardName);
      await delay(randomBetween(1000, 2000));
      const result = page.locator(`[data-test-id^="board-row"] button`).first();
      if ((await result.count()) > 0) {
        await result.click();
        await delay(randomBetween(1000, 2000));
        return;
      }
    }

    // Fallback: click any first board option
    const option = page.locator('[data-test-id^="board-row"] button, div[role="option"]').first();
    if ((await option.count()) > 0) {
      await option.click();
      await delay(randomBetween(1000, 2000));
    }
  } catch (e) {
    console.warn("[pinterest] board selection failed:", e);
  }
}

async function clickPublish(page: Page): Promise<void> {
  const btn = await firstVisible(page, PUBLISH_SELECTORS, 15000);
  await btn.scrollIntoViewIfNeeded();
  await randomDelay(600, 2000);

  for (let i = 0; i < 5; i++) {
    await btn.hover();
    await delay(randomBetween(200, 500));
    await btn.click({ force: false });
    await delay(randomBetween(1000, 2500));
    const stillVisible = await btn.isVisible().catch(() => false);
    if (!stillVisible) return;
    console.warn(`[pinterest] publish btn still visible, retry ${i + 1}`);
  }
}

async function detectCaptcha(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (url.includes("challenge") || url.includes("captcha")) return true;
  const recaptcha = page.locator("#g-recaptcha-response, .g-recaptcha, iframe[title*='reCAPTCHA']");
  if ((await recaptcha.count()) > 0) return true;
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  return ["challenge", "verify your", "unusual traffic", "подтвердите", "капча"].some(
    (k) => bodyText.toLowerCase().includes(k)
  );
}

/* ── main publish function ─────────────────────────────────── */

export async function publishPin(
  content: ContentPlanDocument,
  debug = false
): Promise<PublishResult> {
  let mediaPath: string | null = null;
  const result: PublishResult = { success: false, pinUrl: null };
  const client = buildClient();

  try {
    console.log("[pinterest] initializing stealth client...");
    const loggedIn = await client.init();
    console.log(`[pinterest] init done, logged in: ${loggedIn}`);

    if (!loggedIn) {
      throw new Error(
        "Pinterest session expired. Run `npm run post:save-auth` to refresh cookies."
      );
    }

    const page = client.getPage();
    if (!page) throw new Error("No Playwright page available from client");

    console.log("[pinterest] navigating to pin builder...");
    await page.goto("https://www.pinterest.com/pin-builder/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await delay(randomBetween(3000, 5000));

    if (await detectCaptcha(page)) {
      result.captchaDetected = true;
      const sp = getScreenshotPath();
      await page.screenshot({ path: sp, fullPage: true });
      result.screenshotPath = sp;
      throw new Error("Captcha detected on pin builder");
    }

    console.log("[pinterest] downloading media...");
    mediaPath = await downloadMedia(content.media_url, getTempDir());
    console.log(`[pinterest] media saved: ${path.basename(mediaPath)}`);

    console.log("[pinterest] uploading media...");
    const fileInput = await firstVisible(page, FILE_INPUT_SELECTORS, 15000);
    await fileInput.setInputFiles(mediaPath);
    await delay(randomBetween(3000, 6000));

    console.log("[pinterest] filling title...");
    await fillTitle(page, content.pin_title);

    console.log("[pinterest] filling description...");
    await fillDescription(page, content.pin_description);

    console.log("[pinterest] filling destination link...");
    await fillLink(page, content.destination_link);

    console.log("[pinterest] selecting board...");
    await selectBoard(page, content.board_name);

    if (await detectCaptcha(page)) {
      result.captchaDetected = true;
      const sp = getScreenshotPath();
      await page.screenshot({ path: sp, fullPage: true });
      result.screenshotPath = sp;
      throw new Error("Captcha after filling form");
    }

    console.log("[pinterest] clicking publish...");
    await clickPublish(page);

    // Wait for pin page or success
    console.log("[pinterest] waiting for success...");
    try {
      await page.waitForURL(/\/pin\//, { timeout: 20000 });
      const url = page.url();
      result.success = true;
      result.pinUrl = url;
      console.log(`[pinterest] pin published: ${url}`);
    } catch {
      // Check for success toast
      const toast = page.locator(
        'div[data-test-id="toast-success"], div[role="alert"]:has-text("Saved"), div[role="alert"]:has-text("сохранен")'
      );
      if ((await toast.count()) > 0) {
        result.success = true;
        console.log("[pinterest] success toast detected");
      } else {
        const sp = getScreenshotPath();
        await page.screenshot({ path: sp, fullPage: true });
        result.screenshotPath = sp;
        console.warn("[pinterest] could not confirm success");
      }
    }

    // Save cookies
    const cookies = await client.getCookies();
    if (cookies.length > 0) {
      writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
      console.log(`[pinterest] saved ${cookies.length} cookies to cookies.json`);
    }
  } catch (err) {
    console.error("[pinterest] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("captcha") || message.toLowerCase().includes("challenge")) {
      result.captchaDetected = true;
    }
    try {
      const page = client.getPage();
      if (page) {
        const sp = getScreenshotPath();
        await page.screenshot({ path: sp, fullPage: true });
        result.screenshotPath = sp;
      }
    } catch {
      /* ignore */
    }
    throw new Error(`Pinterest publish failed: ${message}`);
  } finally {
    if (mediaPath) removeFile(mediaPath);
    await client.close().catch(() => {});
  }

  return result;
}

export async function probePinterestSelectors(): Promise<void> {
  const client = buildClient();
  try {
    await client.init();
    const page = client.getPage();
    if (!page) {
      console.log("[probe] no page available");
      return;
    }
    console.log("\n=== Pinterest Probe ===\n");
    console.log(`URL: ${page.url()}`);
    console.log(`Authenticated: ${client.isAuthenticated()}`);
    const title = await page.title().catch(() => "N/A");
    console.log(`Title: ${title}`);

    // Probe our selectors on pin-builder
    await page.goto("https://www.pinterest.com/pin-builder/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await delay(5000);

    const groups: Record<string, readonly string[]> = {
      fileInput: FILE_INPUT_SELECTORS,
      titleInput: TITLE_SELECTORS,
      linkInput: LINK_SELECTORS,
      descInput: DESC_SELECTORS,
      boardTrigger: BOARD_TRIGGER_SELECTORS,
      publishButton: PUBLISH_SELECTORS,
    };

    for (const [group, sels] of Object.entries(groups)) {
      console.log(`\n[${group}]:`);
      for (const sel of sels) {
        const count = await page.locator(sel).count();
        const visible = count > 0 ? await page.locator(sel).first().isVisible().catch(() => false) : false;
        const status = count > 0 ? (visible ? "VISIBLE" : "hidden") : "MISSING";
        console.log(`  ${status.padEnd(8)} count=${String(count).padEnd(3)} ${sel}`);
      }
    }

    console.log("\n=== Probe Complete ===\n");
  } catch (err) {
    console.error("[probe] error:", err);
  } finally {
    await client.close().catch(() => {});
  }
}
