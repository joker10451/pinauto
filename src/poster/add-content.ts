import "dotenv/config";
import { db, Timestamp } from "../firebase";
import type { ContentPlanDocument } from "./types";

const COLLECTION = "content_plan";

async function addContent(): Promise<void> {
  const content: Omit<ContentPlanDocument, "id" | "status"> = {
    pin_title: process.argv[2] || "Проверь эту находку!",
    pin_description:
      process.argv[3] ||
      "Нашёл классную штуку — все подробности и ссылки в Telegram 👉",
    media_url:
      process.argv[4] ||
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800",
    destination_link: process.argv[5] || "https://t.me/smart_zakupka",
    created_at: Timestamp.now(),
  };

  const docRef = await db().collection(COLLECTION).add({
    ...content,
    status: "pending",
  });

  console.log(`✅ Content added: ${docRef.id}`);
  console.log(`   title: ${content.pin_title}`);
  console.log(`   media: ${content.media_url}`);
  console.log(`   link: ${content.destination_link}`);
}

addContent().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
