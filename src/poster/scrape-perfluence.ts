import "dotenv/config";
import { scrapePerfluenceOffers } from "./perfluence";

async function main(): Promise<void> {
  console.log("[perfluence-scraper] starting...");
  const count = await scrapePerfluenceOffers();
  console.log(`[perfluence-scraper] done. Scraped ${count} offers.`);
}

main().catch((err) => {
  console.error("[perfluence-scraper] fatal:", err);
  process.exit(1);
});
