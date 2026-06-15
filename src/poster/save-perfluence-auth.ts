import { chromium } from "playwright";

const PERFLUENCE_URL = "https://dash.perfluence.net";
const PERFLUENCE_AUTH_PATH = "./perfluence_auth.json";

async function main(): Promise<void> {
  console.log("[save-perfluence-auth] Opening Perfluence in browser...");
  console.log(`[save-perfluence-auth] authStatePath: ${PERFLUENCE_AUTH_PATH}`);

  const context = await chromium.launchPersistentContext("./perfluence-profile", {
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

  console.log("[save-perfluence-auth] Navigate to Perfluence and log in manually.");
  console.log("[save-perfluence-auth] After login, press ENTER in this terminal to save the session.");

  await page.goto(PERFLUENCE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      resolve();
    });
  });

  await context.storageState({ path: PERFLUENCE_AUTH_PATH });
  console.log(`[save-perfluence-auth] Session saved to ${PERFLUENCE_AUTH_PATH}`);
  console.log("[save-perfluence-auth] Done!");

  await context.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("[save-perfluence-auth] fatal:", err);
  process.exit(1);
});
