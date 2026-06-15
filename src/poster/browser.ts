import { chromium, type BrowserContext, type Page } from "playwright";
import { config } from "../config";

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
}

function buildProxy() {
  const server = config.poster.proxyServer();
  if (!server) return undefined;

  return {
    server,
    username: config.poster.proxyUsername() || undefined,
    password: config.poster.proxyPassword() || undefined,
  };
}

function buildViewport() {
  const width = config.poster.viewportWidth();
  const height = config.poster.viewportHeight();
  return { width, height };
}

export async function createBrowserSession(): Promise<BrowserSession> {
  const authStatePath = config.poster.authStatePath();
  const proxy = buildProxy();

  console.log(`[browser] authStatePath: ${authStatePath}`);
  if (proxy) {
    console.log(`[browser] proxy: ${proxy.server}`);
  } else {
    console.log("[browser] no proxy configured");
  }

  const browser = await chromium.launch({
    headless: config.poster.headless(),
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const context = await browser.newContext({
    proxy,
    viewport: buildViewport(),
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    geolocation: {
      longitude: 37.6173,
      latitude: 55.7558,
    },
    permissions: ["geolocation"],
    colorScheme: "light",
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    storageState: authStatePath,
  });

  await context.addInitScript(`
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  `);

  const page = context.pages()[0] || (await context.newPage());

  return { context, page };
}

export async function closeBrowserSession(
  context: BrowserContext
): Promise<void> {
  await context.close().catch(() => {});
}
