import path from "node:path";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { PinterestClient } from "pinterest-js-client";
import type { ContentPlanDocument } from "./types";
import { config } from "../config";
import { downloadMedia, removeFile, getScreenshotPath, getTempDir, delay, randomBetween } from "./utils";

export interface PublishResult {
  success: boolean;
  pinUrl: string | null;
  screenshotPath?: string;
  captchaDetected?: boolean;
}

const COOKIES_PATH = path.resolve("cookies.json");

function loadCookies(): any[] {
  // Priority 1: cookies.json (saved by library after posting)
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

  // Priority 2: auth_json.json (storageState format, committed to repo)
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

function buildClient(): PinterestClient {
  const cookies = loadCookies();

  const proxyServer = config.poster.proxyServer();
  const proxy: any | undefined = proxyServer
    ? {
        server: proxyServer,
        username: config.poster.proxyUsername() || undefined,
        password: config.poster.proxyPassword() || undefined,
      }
    : undefined;

  return new PinterestClient({
    headless: config.poster.headless(),
    useFingerprintSuite: true,
    slowMo: 50,
    timeout: 60000,
    viewport: {
      width: config.poster.viewportWidth(),
      height: config.poster.viewportHeight(),
    },
    cookies,
    proxy,
    disableFileCookies: true,
    logLevel: "info" as any,
  });
}

export async function publishPin(
  content: ContentPlanDocument,
  debug = false
): Promise<PublishResult> {
  let mediaPath: string | null = null;
  const result: PublishResult = { success: false, pinUrl: null };
  const client = buildClient();

  try {
    console.log("[pinterest] initializing client with stealth...");
    const loggedIn = await client.init();
    console.log(`[pinterest] init done, logged in: ${loggedIn}`);

    if (!loggedIn) {
      throw new Error(
        "Pinterest session expired or invalid. Run `npm run post:save-auth` to refresh cookies."
      );
    }

    console.log("[pinterest] downloading media...");
    mediaPath = await downloadMedia(content.media_url, getTempDir());
    console.log(`[pinterest] media saved: ${path.basename(mediaPath)}`);

    console.log("[pinterest] creating pin...");
    const pinUrl = await client.createPin({
      imageFile: mediaPath,
      title: content.pin_title,
      description: content.pin_description,
      link: content.destination_link,
      boardName: content.board_name || undefined,
    });

    if (pinUrl) {
      result.success = true;
      result.pinUrl = pinUrl;
      console.log(`[pinterest] pin published: ${pinUrl}`);
    } else {
      // createPin returns null on failure but may have still succeeded
      // Check if the page navigated to a pin URL
      const page = client.getPage();
      if (page) {
        const url = page.url();
        if (url.includes("/pin/")) {
          result.success = true;
          result.pinUrl = url;
          console.log(`[pinterest] pin published (detected from URL): ${url}`);
        } else {
          const sp = getScreenshotPath();
          await client.screenshot(sp);
          result.screenshotPath = sp;
          console.warn("[pinterest] createPin returned null, pin may not have been created");
        }
      }
    }

    // Save cookies for next run
    await client.saveCookies();
    const updatedCookies = await client.getCookies();
    if (updatedCookies.length > 0) {
      writeFileSync(COOKIES_PATH, JSON.stringify(updatedCookies, null, 2));
      console.log(`[pinterest] saved ${updatedCookies.length} cookies to cookies.json`);
    }
  } catch (err) {
    console.error("[pinterest] error:", err);
    const message = err instanceof Error ? err.message : String(err);

    // Check for captcha/challenge
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
      /* ignore screenshot error */
    }

    // Re-throw with context
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

    console.log("\n=== Pinterest Probe (via pinterest-js-client) ===\n");
    console.log(`URL: ${page.url()}`);
    const title = await page.title().catch(() => "N/A");
    console.log(`Title: ${title}`);
    console.log(`Authenticated: ${client.isAuthenticated()}`);
    console.log("\n=== Probe Complete ===\n");
  } catch (err) {
    console.error("[probe] error:", err);
  } finally {
    await client.close().catch(() => {});
  }
}
