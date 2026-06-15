/**
 * Centralised env access with explicit fail-fast validation.
 * Imported lazily so cold starts only validate what each function needs.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  bot: {
    token: () => required("BOT_TOKEN"),
    webhookSecret: () => required("TELEGRAM_WEBHOOK_SECRET"),
    publicBaseUrl: () => optional("PUBLIC_BASE_URL"),
  },
  firebase: {
    serviceAccountB64: () => required("FIREBASE_SERVICE_ACCOUNT_B64"),
  },
  leadMagnet: {
    url: () => optional("LEAD_MAGNET_URL"),
    text: () =>
      optional(
        "LEAD_MAGNET_TEXT",
        "Here is your free material as promised. Enjoy!"
      ),
  },
  premium: {
    priceUsdt: () => Number(optional("PREMIUM_PRICE_USDT", "15")),
    title: () => optional("PREMIUM_TITLE", "Premium Access"),
    deliveryUrl: () => optional("PREMIUM_DELIVERY_URL"),
  },
  cryptoPay: {
    token: () => required("CRYPTO_PAY_TOKEN"),
    network: () =>
      (optional("CRYPTO_PAY_NETWORK", "mainnet") as "mainnet" | "testnet"),
    apiBase: () =>
      optional("CRYPTO_PAY_NETWORK", "mainnet") === "testnet"
        ? "https://testnet-pay.crypt.bot/api"
        : "https://pay.crypt.bot/api",
  },
  boosty: {
    webhookSecret: () => required("BOOSTY_WEBHOOK_SECRET"),
    pageUrl: () => optional("BOOSTY_PAGE_URL"),
  },
  cron: {
    secret: () => required("CRON_SECRET"),
  },
  poster: {
    contentPlanCollection: () =>
      optional("CONTENT_PLAN_COLLECTION", "content_plan"),
    tempDir: () => optional("TEMP_DIR", "./temp"),
    screenshotsDir: () => optional("SCREENSHOTS_DIR", "./screenshots"),
    userDataDir: () => optional("USER_DATA_DIR", "./browser-profile"),
    authStatePath: () => optional("AUTH_STATE_PATH", "./auth_json.json"),
    proxyServer: () => optional("PROXY_SERVER"),
    proxyUsername: () => optional("PROXY_USERNAME"),
    proxyPassword: () => optional("PROXY_PASSWORD"),
    viewportWidth: () => Number(optional("VIEWPORT_WIDTH", "1366")),
    viewportHeight: () => Number(optional("VIEWPORT_HEIGHT", "768")),
    headless: () => optional("HEADLESS", "false") === "true",
    postIntervalSec: () =>
      Number(optional("POST_INTERVAL_SEC", "300")),
  },
};
