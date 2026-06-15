import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { db, Timestamp } from "../firebase";
import { config } from "../config";
import type { ContentPlanDocument } from "./types";

const PERFLUENCE_URL = "https://dash.perfluence.net";
const PERFLUENCE_AUTH_PATH = "./perfluence_auth.json";

interface PerfluenceOffer {
  id: string;
  brandName: string;
  title: string;
  description: string;
  creativeUrl: string;
  refLink: string;
  deadlineAt?: Date;
}

async function createPerfluenceSession(): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const context = await browser.newContext({
    storageState: PERFLUENCE_AUTH_PATH,
    viewport: { width: 1366, height: 768 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",
  });

  const page = context.pages()[0] || (await context.newPage());

  return { browser, context, page };
}

async function scrapeOffers(page: Page): Promise<PerfluenceOffer[]> {
  console.log("[perfluence] navigating to dashboard...");
  await page.goto(PERFLUENCE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  }).catch(async () => {
    console.warn("[perfluence] page load timed out, continuing anyway...");
  });

  await page.waitForTimeout(15000);

  // Проверяем, что авторизация успешна
  const currentUrl = page.url();
  if (currentUrl.includes("login") || currentUrl.includes("auth")) {
    throw new Error("Perfluence login required. Run save-perfluence-auth first.");
  }

  console.log("[perfluence] scraping offers...");

  // Ищем карточки офферов на странице
  const offers: PerfluenceOffer[] = [];

  // Попытка 1: ищем элементы с data-атрибутами
  const offerCards = page.locator(
    '[data-test-id*="offer"], [data-testid*="offer"], .offer-card, .project-card, [class*="offer"], [class*="project"]'
  );

  const count = await offerCards.count();
  console.log(`[perfluence] found ${count} potential offer cards`);

  for (let i = 0; i < Math.min(count, 5); i++) {
    const card = offerCards.nth(i);
    const visible = await card.isVisible().catch(() => false);
    if (!visible) continue;

    const text = await card.innerText().catch(() => "");
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    
    const brandName = lines[0] || "Unknown Brand";
    const title = lines[1] || brandName;
    const description = lines.slice(1, 4).join(" ").slice(0, 300) || text.slice(0, 300);

    const imgSrc =
      (await card.locator("img").first().getAttribute("src").catch(() => "")) || "";

    const refLink =
      (await card.locator("a").first().getAttribute("href").catch(() => "")) || "";

    if (title && title.length > 5) {
      offers.push({
        id: `${Date.now()}-${i}`,
        brandName,
        title,
        description,
        creativeUrl: imgSrc,
        refLink,
      });
    }
  }

  // Если не нашли через карточки, пробуем другой подход
  if (offers.length === 0) {
    console.log("[perfluence] fallback scraping...");
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const lines = bodyText.split("\n").filter((line) => line.trim().length > 20);

    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const text = lines[i].trim();
      offers.push({
        id: `${Date.now()}-${i}`,
        brandName: text.split(" ")[0],
        title: text.slice(0, 80),
        description: text,
        creativeUrl: "",
        refLink: "",
      });
    }
  }

  return offers.slice(0, 5);
}

async function saveOffersToFirestore(
  offers: PerfluenceOffer[]
): Promise<void> {
  const collection = config.poster.contentPlanCollection();
  const batch = db().batch();

  for (const offer of offers) {
    if (!offer.creativeUrl) continue;

    const content: Record<string, unknown> = {
      pin_title: offer.title,
      pin_description: offer.description,
      media_url: offer.creativeUrl,
      destination_link: "https://t.me/smart_zakupka",
      perfluence_offer_id: offer.id,
      perfluence_ref_link: offer.refLink,
      created_at: Timestamp.now(),
    };

    if (offer.deadlineAt) {
      content.deadline_at = Timestamp.fromDate(offer.deadlineAt);
    }

    const docRef = db().collection(collection).doc();
    batch.set(docRef, {
      ...content,
      status: "pending",
    });
  }

  await batch.commit();
  console.log(`[perfluence] saved ${offers.length} offers to Firestore`);
}

export async function scrapePerfluenceOffers(): Promise<number> {
  const { browser, context, page } = await createPerfluenceSession();

  try {
    const offers = await scrapeOffers(page);
    console.log(`[perfluence] scraped ${offers.length} offers`);

    await saveOffersToFirestore(offers);

    // Сохраняем обновлённую сессию
    await context.storageState({ path: PERFLUENCE_AUTH_PATH });

    return offers.length;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
