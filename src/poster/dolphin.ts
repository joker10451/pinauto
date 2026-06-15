// Dolphin{anty} integration removed.
// This file is kept for backward compatibility but is no longer used.
// The free version uses Playwright persistent browser contexts instead.

export async function startProfile(): Promise<never> {
  throw new Error("Dolphin integration is disabled. Use browser.ts instead.");
}

export async function stopProfile(): Promise<void> {
  // No-op for backward compatibility
}
