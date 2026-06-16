import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { config } from "../config";

async function main(): Promise<void> {
  const userDataDir = config.poster.userDataDir();
  const authStatePath = config.poster.authStatePath();

  console.log("[save-auth] Opening Pinterest in browser...");
  console.log(`[save-auth] userDataDir: ${userDataDir}`);
  console.log(`[save-auth] authStatePath: ${authStatePath}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const page = context.pages()[0] || (await context.newPage());

  console.log("[save-auth] Navigate to Pinterest and log in manually.");
  console.log("[save-auth] After login, press ENTER in this terminal to save the session.");

  await page.goto("https://www.pinterest.com", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      resolve();
    });
  });

  // Save full storageState (for backward compat)
  await context.storageState({ path: authStatePath });
  console.log(`[save-auth] Session saved to ${authStatePath}`);

  // Also save cookies separately for pinterest-js-client
  const cookies = await context.cookies();
  const cookiesPath = authStatePath.replace(/\.json$/, "_cookies.json");
  writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
  console.log(`[save-auth] Cookies saved to ${cookiesPath} (${cookies.length} cookies)`);

  console.log("[save-auth] Done! You can now close the browser.");

  await context.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("[save-auth] fatal:", err);
  process.exit(1);
});
