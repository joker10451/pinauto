import path from "node:path";
import type { Page, Locator } from "playwright";
import type { ContentPlanDocument } from "./types";
import {
  randomDelay,
  randomBetween,
  delay,
  humanTypeLocator,
  debugScreenshot,
  downloadMedia,
  removeFile,
  getScreenshotPath,
  getTempDir,
} from "./utils";

const PIN_BUILDER_URL = "https://www.pinterest.com/pin-builder/";
const LOGIN_REDIRECT_KEYWORDS = ["login", "log in", "sign in", "welcome"];

const SELECTORS = {
  fileInput: [
    'input[type="file"]',
    '[data-test-id="media-upload-input"] input[type="file"]',
    'div[data-test-id="media-upload"] input[type="file"]',
    '[data-test-id="upload-container"] input',
    'div[role="button"] input[type="file"]',
  ] as const,
  titleInput: [
    "textarea#pinTitle",
    'input[placeholder*="заголовок"]',
    'input[placeholder*="Заголовок"]',
    'input[placeholder*="название"]',
    'input[placeholder*="Название"]',
    'input[placeholder*="title"]',
    'input[placeholder*="Title"]',
    'input[placeholder*="Add your title"]',
    'textarea[placeholder="Добавьте название"]',
    'textarea[placeholder*="Добавьте название"]',
    'textarea[placeholder*="название"]',
    'textarea[placeholder*="Название"]',
    'textarea[placeholder*="title"]',
    'textarea[placeholder*="Title"]',
    'textarea[placeholder*="Add your title"]',
    'textarea[placeholder*="Заголовок"]',
    'div[data-test-id="pin-title"] textarea',
    '[data-test-id="pin-name-input"] textarea',
    '[data-test-id="pin-title-input"] textarea',
    '[data-test-id="title-input"] textarea',
    'textarea[aria-label*="title"]',
    'textarea[aria-label*="Title"]',
    'textarea[aria-label*="Название"]',
    'textarea[aria-label*="Заголовок"]',
    'input[data-test-id="pin-title"]',
    'input[aria-label*="title"]',
    'input[aria-label*="Title"]',
    'input[aria-label*="Название"]',
    'input[aria-label*="Заголовок"]',
    '[data-test-id="pin-title"]',
    '[data-test-id="pin-name-input"]',
    '[data-test-id="pin-title-input"]',
    '[data-test-id="title-input"]',
    'div[role="textbox"][aria-label*="title"]',
    'div[role="textbox"][aria-label*="Title"]',
    'div[role="textbox"][aria-label*="Название"]',
    'div[role="textbox"][aria-label*="Заголовок"]',
    'input[type="text"]',
    'div[contenteditable="true"]',
    'textarea',
  ] as const,
  descriptionInput: [
    'textarea[placeholder*="description"]',
    'textarea[placeholder*="Description"]',
    'textarea[placeholder*="Describe"]',
    'textarea[placeholder*="Расскажите"]',
    'textarea[placeholder*="Описание"]',
    'textarea[placeholder*="описание"]',
    'div[data-test-id="pin-description"] textarea',
    '[data-test-id="pin-desc-input"] textarea',
    '[data-test-id="pin-description-input"] textarea',
    '[data-test-id="description-input"] textarea',
    'textarea[aria-label*="description"]',
    'textarea[aria-label*="Description"]',
    'textarea[aria-label*="Описание"]',
    'textarea[class*="description"]',
    'textarea[class*="Description"]',
    '[data-test-id="pin-description"]',
    '[data-test-id="pin-desc-input"]',
    '[data-test-id="pin-description-input"]',
    '[data-test-id="description-input"]',
    'div[role="textbox"][aria-label*="description"]',
    'div[role="textbox"][aria-label*="Description"]',
    'div[role="textbox"][aria-label*="Описание"]',
    'div[contenteditable="true"]:nth-of-type(2)',
    'textarea:nth-of-type(2)',
    'textarea:nth-child(2)',
  ] as const,
  linkInput: [
    'input[placeholder*="целевую ссылку"]',
    'input[placeholder*="ссылку"]',
    'input[placeholder*="Ссылка"]',
    'input[placeholder*="link"]',
    'input[placeholder*="Link"]',
    'input[placeholder*="URL"]',
    'input[placeholder*="website"]',
    'input[placeholder*="Website"]',
    'input[placeholder*="destination"]',
    'textarea[placeholder="Добавьте целевую ссылку"]',
    'textarea[placeholder*="Добавьте целевую ссылку"]',
    'textarea[placeholder*="целевую ссылку"]',
    'textarea[placeholder*="ссылку"]',
    'textarea[placeholder*="link"]',
    'textarea[placeholder*="Link"]',
    'textarea[placeholder*="URL"]',
    '[data-test-id="pin-link"] input',
    'div[data-test-id="destination-link"] input',
    '[data-test-id="pin-link-input"] input',
    '[data-test-id="link-input"] input',
    'input[aria-label*="link"]',
    'input[aria-label*="Link"]',
    'input[aria-label*="URL"]',
    'input[aria-label*="Ссылка"]',
    'input[type="url"]',
    'input[type="text"]',
    '[data-test-id="pin-link"]',
    '[data-test-id="pin-link-input"]',
    '[data-test-id="link-input"]',
    '[data-test-id="destination-link"]',
    'div[role="textbox"][aria-label*="link"]',
    'div[role="textbox"][aria-label*="Link"]',
    'div[role="textbox"][aria-label*="URL"]',
    'div[role="textbox"][aria-label*="Ссылка"]',
  ] as const,
  boardTrigger: [
    '[data-test-id="board-dropdown-select-button"]',
    'div[data-test-id="board-selector"] button',
    '[data-test-id="board-selector"]',
    'div[role="listbox"]',
    'button:has-text("Board")',
    '[data-test-id="board-dropdown"]',
    'div[data-test-id="board-dropdown"]',
  ] as const,
  boardOption: [
    '[data-test-id="board-row"]',
    'div[role="option"]',
    'div[data-test-id="board-selector-item"]',
    '[data-test-id="board-item"]',
    'div[role="option"] div',
  ] as const,
  boardOptionByName: (name: string) => [
    `text="${name}"`,
    `[data-test-id="board-row"]:has-text("${name}")`,
    `div[role="option"]:has-text("${name}")`,
  ] as const,
  publishButton: [
    'button[data-test-id="publish-button"]',
    'button:has-text("Publish")',
    'button:has-text("Save")',
    'div[data-test-id="circle-publish-button"] button',
    '[data-test-id="pin-builder-save"]',
    'button:has-text("Опубликовать")',
    'button:has-text("Сохранить")',
  ] as const,
  successToast: [
    'div[data-test-id="toast-success"]',
    'div[role="alert"][aria-label*="success"]',
    'div[role="alert"]:has-text("published")',
    'div[role="alert"]:has-text("Saved")',
    'div[role="alert"]:has-text("сохранен")',
    'div[role="alert"]:has-text("опубликован")',
  ] as const,
  loginForm: [
    'form[data-test-id="login-form"]',
    'input[aria-label*="email"]',
    'input[aria-label*="Email"]',
    'input[name="id"]',
  ] as const,
  createButton: [
    'a[href="/pin-builder/"]',
    'button:has-text("Create")',
    'a:has-text("Create")',
    'div[data-test-id="create-button"]',
    'a[data-test-id="create-button"]',
  ] as const,
};

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await delay(randomBetween(500, 1500));
}

async function firstVisible(
  page: Page,
  selectors: readonly string[],
  timeout = 5000
): Promise<Locator> {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      const count = await loc.count();
      if (count > 0) {
        return loc;
      }
    } catch {
      continue;
    }
  }
  const fallback = selectors.join(", ");
  return page.locator(fallback).first();
}

async function debugPageStructure(page: Page): Promise<void> {
  try {
    const info = await page.evaluate(`
      (() => {
        const textareas = Array.from(document.querySelectorAll("textarea")).map((el) => ({
          placeholder: el.placeholder,
          ariaLabel: el.getAttribute("aria-label"),
          id: el.id,
          class: el.className,
        }));
        const inputs = Array.from(document.querySelectorAll("input")).map((el) => ({
          type: el.type,
          placeholder: el.placeholder,
          ariaLabel: el.getAttribute("aria-label"),
          id: el.id,
          class: el.className,
        }));
        return { textareas, inputs, url: window.location.href };
      })()
    `);
    console.log("[pinterest] page structure:", JSON.stringify(info, null, 2));
  } catch {
    console.warn("[pinterest] could not dump page structure");
  }
}

async function ensureLoggedIn(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  const body = page.locator("body");
  let text: string;
  try {
    text = await body.innerText({ timeout: 3000 });
  } catch {
    text = "";
  }
  const needsLogin =
    LOGIN_REDIRECT_KEYWORDS.some((k) => url.includes(k)) ||
    LOGIN_REDIRECT_KEYWORDS.some((k) => text.toLowerCase().includes(k));

  if (needsLogin) {
    console.warn("[pinterest] login page detected — browser session may not be logged into Pinterest");
    return false;
  }
  return true;
}

async function uploadMedia(page: Page, mediaPath: string): Promise<void> {
  const input = await firstVisible(page, SELECTORS.fileInput, 10000);
  await input.setInputFiles(mediaPath);
  await delay(randomBetween(2500, 5000));
}

async function fillFieldLocator(
  loc: Locator,
  text: string
): Promise<void> {
  await loc.scrollIntoViewIfNeeded();
  await randomDelay();
  await humanTypeLocator(loc, text);
}

async function waitForFormReady(page: Page, debug = false): Promise<void> {
  // Ждём пока после загрузки медиа появится форма с полями
  try {
    await page.waitForSelector(
      'textarea, input[placeholder*="заголовок"], input[placeholder*="Заголовок"], input[placeholder*="title"], input[placeholder*="Title"], input[placeholder*="целевую ссылку"], input[placeholder*="link"], input[placeholder*="Link"]',
      { timeout: 90000 }
    );
  } catch {
    console.warn("[pinterest] form readiness check timed out, continuing...");
  }
  
  await debugScreenshot(page, "form_ready_check", debug);
  await delay(randomBetween(2000, 4000));
}

async function fillField(
  page: Page,
  selectors: readonly string[],
  text: string
): Promise<void> {
  let loc: Locator;
  let attempts = 0;

  while (attempts < 3) {
    try {
      loc = await firstVisible(page, selectors, 8000);
      await fillFieldLocator(loc, text);
      return;
    } catch (err) {
      attempts++;
      console.warn(`[pinterest] field not found, retry ${attempts}/3`);
      await delay(randomBetween(2000, 4000));
      await page.screenshot({
        path: getScreenshotPath(),
        fullPage: false,
      }).catch(() => {});
    }
  }

  throw new Error(`Could not find field with selectors: ${selectors.join(", ")}`);
}

async function selectBoard(
  page: Page,
  boardName?: string
): Promise<void> {
  const trigger = await firstVisible(page, SELECTORS.boardTrigger, 10000);
  const visible = await trigger.isVisible().catch(() => false);
  if (!visible) {
    console.warn("[pinterest] board trigger not found, skipping board selection");
    return;
  }
  await trigger.scrollIntoViewIfNeeded();
  await randomDelay(600, 1500);
  await trigger.click();
  await delay(randomBetween(1200, 2200));

  let option: Locator;
  if (boardName) {
    const namedSelectors = SELECTORS.boardOptionByName(boardName);
    option = await firstVisible(page, namedSelectors, 5000);
  } else {
    option = await firstVisible(page, SELECTORS.boardOption, 5000);
  }

  if (await option.isVisible().catch(() => false)) {
    await randomDelay(300, 800);
    await option.click();
    await delay(randomBetween(1000, 2000));
  } else {
    console.warn("[pinterest] no board option found");
  }
}

async function clickPublish(page: Page): Promise<void> {
  const btn = await firstVisible(page, SELECTORS.publishButton, 15000);
  await btn.scrollIntoViewIfNeeded();
  await randomDelay(800, 2500);

  for (let i = 0; i < 3; i++) {
    await btn.hover();
    await delay(randomBetween(200, 500));
    await btn.click({ force: false });
    await delay(randomBetween(500, 1000));

    const stillVisible = await btn.isVisible().catch(() => false);
    if (!stillVisible) return;
    console.warn(`[pinterest] publish btn still visible after click, retry ${i + 1}`);
  }
}

async function waitForPinPage(page: Page): Promise<string | null> {
  try {
    await page.waitForURL(/\/pin\//, { timeout: 45000 });
    await delay(randomBetween(1000, 2000));
    return page.url();
  } catch {
    return null;
  }
}

async function waitForSuccess(page: Page): Promise<boolean> {
  try {
    const toast = await firstVisible(page, SELECTORS.successToast, 20000);
    await toast.waitFor({ state: "visible", timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function detectCaptcha(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (url.includes("challenge") || url.includes("captcha")) return true;

  // Проверяем наличие reCAPTCHA на странице
  const recaptcha = page.locator("#g-recaptcha-response, .g-recaptcha, iframe[title*='reCAPTCHA']");
  const recaptchaVisible = await recaptcha.count().then((count) => count > 0).catch(() => false);
  if (recaptchaVisible) return true;

  const body = page.locator("body");
  const text = await body.innerText({ timeout: 3000 }).catch(() => "");
  const keywords = [
    "challenge",
    "verify your",
    "automated",
    "unusual traffic",
    "security check",
    "подтвердите",
    "капча",
  ];
  return keywords.some((k) => text.toLowerCase().includes(k));
}

export interface PublishResult {
  success: boolean;
  pinUrl: string | null;
  screenshotPath?: string;
  captchaDetected?: boolean;
}

export async function publishPin(
  page: Page,
  content: ContentPlanDocument,
  debug = false
): Promise<PublishResult> {
  let mediaPath: string | null = null;

  const result: PublishResult = { success: false, pinUrl: null };

  try {

    console.log("[pinterest] navigating to pin builder...");
    await page.goto(PIN_BUILDER_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await waitForPageReady(page);
    await debugScreenshot(page, "1_pin_builder_loaded", debug);

    if (await detectCaptcha(page)) {
      result.captchaDetected = true;
      const sp = getScreenshotPath();
      await page.screenshot({ path: sp, fullPage: true });
      result.screenshotPath = sp;
      throw new Error("Captcha detected on pin builder page");
    }

    const loggedIn = await ensureLoggedIn(page);
    if (!loggedIn) {
      const sp = getScreenshotPath();
      await page.screenshot({ path: sp, fullPage: true });
      result.screenshotPath = sp;
      throw new Error("Pinterest login page detected. Browser session needs valid Pinterest cookies.");
    }

    console.log("[pinterest] downloading media...");
    mediaPath = await downloadMedia(content.media_url, getTempDir());
    console.log(`[pinterest] media saved: ${path.basename(mediaPath)}`);

    console.log("[pinterest] uploading media...");
    await uploadMedia(page, mediaPath);
    await debugScreenshot(page, "2_media_uploaded", debug);
    await waitForFormReady(page, debug);
    await debugPageStructure(page);

    console.log("[pinterest] filling title...");
    await fillField(page, SELECTORS.titleInput, content.pin_title);
    await randomDelay(500, 1200);
    await debugScreenshot(page, "3_title_filled", debug);

    console.log("[pinterest] filling description...");
    await fillField(page, SELECTORS.descriptionInput, content.pin_description);
    await randomDelay(500, 1200);
    await debugScreenshot(page, "4_description_filled", debug);

    console.log("[pinterest] filling destination link...");
    await fillField(page, SELECTORS.linkInput, content.destination_link);
    await randomDelay(800, 1800);
    await debugScreenshot(page, "5_link_filled", debug);

    console.log("[pinterest] selecting board...");
    await selectBoard(page, content.board_name);
    await debugScreenshot(page, "6_board_selected", debug);

    if (await detectCaptcha(page)) {
      result.captchaDetected = true;
      const sp = getScreenshotPath();
      await page.screenshot({ path: sp, fullPage: true });
      result.screenshotPath = sp;
      throw new Error("Captcha detected after filling form");
    }

    const currentUrl = page.url();
    console.log("[pinterest] clicking publish...");
    await clickPublish(page);

    console.log("[pinterest] waiting for navigation to pin page...");
    const pinUrl = await waitForPinPage(page);

    if (pinUrl) {
      result.success = true;
      result.pinUrl = pinUrl;
      console.log(`[pinterest] pin published: ${pinUrl}`);
    } else {
      console.log("[pinterest] checking for success toast...");
      const toast = await waitForSuccess(page);
      if (toast) {
        result.success = true;
        const urlAfter = page.url();
        if (urlAfter !== currentUrl) {
          result.pinUrl = urlAfter;
        }
        console.log("[pinterest] success toast confirmed");
      } else {
        const sp = getScreenshotPath();
        await page.screenshot({ path: sp, fullPage: true });
        result.screenshotPath = sp;
        console.warn("[pinterest] could not confirm publish success");
      }
    }

    await debugScreenshot(page, "7_final_state", debug);
    await delay(randomBetween(1000, 2000));
  } catch (err) {
    console.error("[pinterest] error:", err);
    if (page && !result.screenshotPath) {
      try {
        const sp = getScreenshotPath();
        await page.screenshot({ path: sp, fullPage: true });
        result.screenshotPath = sp;
      } catch {
        /* ignore */
      }
    }
  } finally {
    if (mediaPath) removeFile(mediaPath);
  }

  return result;
}

export async function probePinterestSelectors(
  page: Page
): Promise<void> {
  try {

    console.log("\n=== Pinterest Selector Probe ===\n");
    await page.goto(PIN_BUILDER_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: getScreenshotPath().replace("error", "probe_page"),
      fullPage: false,
    });

    const allSelectors = {
      ...SELECTORS,
      fileInput: [
        ...SELECTORS.fileInput,
        ...SELECTORS.titleInput.map((s) => s.replace("textarea", "input")),
      ],
    };

    for (const [group, sels] of Object.entries(allSelectors)) {
      if (typeof sels === "function") continue;
      console.log(`\n[${group}]:`);
      for (const sel of sels as readonly string[]) {
        try {
          const count = await page.locator(sel).count();
          const visible = count > 0
            ? await page.locator(sel).first().isVisible().catch(() => false)
            : false;
          const status = count > 0 ? (visible ? "VISIBLE" : "hidden") : "MISSING";
          console.log(`  ${status.padEnd(8)} count=${String(count).padEnd(3)} ${sel}`);
        } catch {
          console.log(`  ERROR    ${sel}`);
        }
      }
    }

    console.log("\n[page info]:");
    console.log(`  URL: ${page.url()}`);
    const title = await page.title().catch(() => "N/A");
    console.log(`  Title: ${title}`);
    console.log("\n=== Probe Complete ===\n");
  } catch (err) {
    console.error("[probe] error:", err);
  }
}
