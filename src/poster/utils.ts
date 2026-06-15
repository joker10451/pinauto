import { randomInt } from "node:crypto";
import { mkdirSync, unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import { config } from "../config";

let debugCounter = 0;

export function randomBetween(min: number, max: number): number {
  return randomInt(min, max + 1);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function randomDelay(min = 400, max = 1600): Promise<void> {
  await delay(randomBetween(min, max));
}

export async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  const loc = page.locator(selector).first();
  const count = await loc.count();
  if (count === 0) {
    throw new Error(`humanType: selector "${selector}" not found`);
  }
  await loc.scrollIntoViewIfNeeded();
  await delay(randomBetween(200, 500));
  await loc.click();
  await delay(randomBetween(100, 300));
  await loc.fill("");
  await delay(randomBetween(150, 400));
  for (const char of text) {
    await loc.press(char, { delay: randomBetween(30, 120) });
  }
  await delay(randomBetween(100, 300));
}

export async function humanTypeLocator(
  loc: import("playwright").Locator,
  text: string
): Promise<void> {
  const count = await loc.count();
  if (count === 0) {
    throw new Error("humanTypeLocator: locator not found");
  }
  await loc.scrollIntoViewIfNeeded();
  await delay(randomBetween(200, 500));
  await loc.click();
  await delay(randomBetween(100, 300));
  await loc.fill("");
  await delay(randomBetween(150, 400));
  for (const char of text) {
    await loc.press(char, { delay: randomBetween(30, 120) });
  }
  await delay(randomBetween(100, 300));
}

export async function humanClick(
  page: Page,
  selector: string
): Promise<void> {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  await delay(randomBetween(300, 800));
  await loc.hover();
  await delay(randomBetween(200, 500));
  await loc.click();
  await delay(randomBetween(200, 500));
}

export async function humanClickLocator(loc: import("playwright").Locator): Promise<void> {
  await loc.scrollIntoViewIfNeeded();
  await delay(randomBetween(300, 800));
  await loc.hover();
  await delay(randomBetween(200, 500));
  await loc.click();
  await delay(randomBetween(200, 500));
}

export async function debugScreenshot(
  page: Page,
  step: string,
  debug = false
): Promise<string | null> {
  if (!debug) return null;
  debugCounter++;
  const dir = config.poster.screenshotsDir();
  mkdirSync(dir, { recursive: true });
  const name = `step_${String(debugCounter).padStart(2, "0")}_${step.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.png`;
  const fp = path.join(dir, name);
  await page.screenshot({ path: fp, fullPage: false });
  console.log(`  [debug] screenshot: ${name}`);
  return fp;
}

export async function downloadMedia(
  url: string,
  destDir: string
): Promise<string> {
  mkdirSync(destDir, { recursive: true });
  const ext = path.extname(new URL(url).pathname) || ".jpg";
  const filename = `pin_${Date.now()}_${randomBetween(100, 999)}${ext}`;
  const filepath = path.join(destDir, filename);

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(
      `Failed to download media: ${resp.status} ${resp.statusText}`
    );
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  await writeFile(filepath, buffer);
  return filepath;
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function removeFile(filepath: string): void {
  try {
    unlinkSync(filepath);
  } catch {
    /* ignore */
  }
}

export function getScreenshotPath(): string {
  const dir = config.poster.screenshotsDir();
  ensureDir(dir);
  return path.join(
    dir,
    `error_${Date.now()}_${randomBetween(1000, 9999)}.png`
  );
}

export function getTempDir(): string {
  const dir = config.poster.tempDir();
  ensureDir(dir);
  return dir;
}
