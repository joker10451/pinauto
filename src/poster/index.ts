import "dotenv/config";
import { db, Timestamp } from "../firebase";
import { config } from "../config";
import type { ContentPlanDocument, ContentStatus } from "./types";
import { createBrowserSession, closeBrowserSession } from "./browser";
import { publishPin, probePinterestSelectors } from "./pinterest";
import { delay, randomBetween } from "./utils";

const COLLECTION = () => config.poster.contentPlanCollection();

let DEBUG = false;

async function getPendingContent(): Promise<
  (ContentPlanDocument & { id: string }) | null
> {
  const snapshot = await db()
    .collection(COLLECTION())
    .where("status", "==", "pending")
    .orderBy("created_at", "asc")
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as ContentPlanDocument & {
    id: string;
  };
}

async function updateContentStatus(
  docId: string,
  status: ContentStatus,
  extra: Partial<ContentPlanDocument> = {}
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    updated_at: Timestamp.now(),
    ...extra,
  };
  if (status === "published") {
    payload.published_at = Timestamp.now();
  }

  await db().collection(COLLECTION()).doc(docId).update(payload);
}

async function processOne(): Promise<boolean> {
  const content = await getPendingContent();
  if (!content) {
    console.log("[poster] no pending content found");
    return false;
  }

  console.log(`[poster] processing content: ${content.id}`);
  console.log(`  title: ${content.pin_title.slice(0, 60)}...`);

  await updateContentStatus(content.id, "publishing");

  let browserContext: import("playwright").BrowserContext | null = null;

  try {
    console.log("[poster] creating browser session...");
    const session = await createBrowserSession();
    browserContext = session.context;
    console.log("[poster] browser session created");

    const result = await publishPin(session.page, content, DEBUG);

    if (result.success) {
      console.log("[poster] pin published successfully!");
      const extra: Partial<ContentPlanDocument> = {};
      if (result.pinUrl) {
        extra.pin_url = result.pinUrl;
        console.log(`[poster] pin URL: ${result.pinUrl}`);
      }
      await updateContentStatus(content.id, "published", extra);
    } else {
      console.warn("[poster] publish failed");
      const extra: Partial<ContentPlanDocument> = {
        error_message: "Publish did not confirm success",
      };
      if (result.screenshotPath) {
        extra.error_screenshot_base64 = result.screenshotPath;
      }
      if (result.captchaDetected) {
        extra.error_message = "Captcha or challenge page detected";
      }
      if (result.pinUrl) {
        extra.pin_url = result.pinUrl;
      }
      await updateContentStatus(content.id, "error", extra);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[poster] FATAL: ${message}`);

    const extra: Partial<ContentPlanDocument> = {
      error_message: message.slice(0, 500),
    };

    await updateContentStatus(content.id, "error", extra).catch((e) =>
      console.error("[poster] failed to update error status:", e)
    );
  } finally {
    if (browserContext) {
      try {
        console.log("[poster] closing browser session...");
        await closeBrowserSession(browserContext);
        console.log("[poster] browser session closed");
      } catch (e) {
        console.warn("[poster] failed to close browser session:", e);
      }
    }
  }

  return true;
}

async function runProbe(): Promise<void> {
  console.log("[probe] creating browser session...");
  const session = await createBrowserSession();
  console.log("[probe] browser session created");
  await delay(3000);

  await probePinterestSelectors(session.page);

  console.log("[probe] closing browser session...");
  await closeBrowserSession(session.context);
  console.log("[probe] done");
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const once = args.includes("--once");
  const probe = args.includes("--probe");
  DEBUG = args.includes("--debug");
  const intervalMs = config.poster.postIntervalSec() * 1000;

  if (probe) {
    await runProbe();
    return;
  }

  console.log(`[poster] starting Pinterest auto-poster (once=${once}, debug=${DEBUG})`);

  if (once) {
    await processOne();
    console.log("[poster] done (--once mode)");
    process.exit(0);
  }

  while (true) {
    try {
      const hadWork = await processOne();
      if (!hadWork) {
        console.log(`[poster] no work, sleeping ${config.poster.postIntervalSec()}s...`);
      } else {
        console.log(`[poster] cycle done, next in ${config.poster.postIntervalSec()}s...`);
      }
    } catch (err) {
      console.error("[poster] unhandled cycle error:", err);
    }
    await delay(intervalMs);
  }
}

main().catch((err) => {
  console.error("[poster] fatal:", err);
  process.exit(1);
});
