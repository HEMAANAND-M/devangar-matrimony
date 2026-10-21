import { chromium } from "playwright-core";

/**
 * Browser used by every suite. E2E_BROWSER_CHANNEL picks an installed browser ("msedge", "chrome");
 * the default is Edge on Windows and Playwright's bundled Chromium elsewhere (CI).
 * Set E2E_BROWSER_CHANNEL="" to force the bundled Chromium on Windows too.
 */
export function launch(options = {}) {
  const channel = process.env.E2E_BROWSER_CHANNEL ?? (process.platform === "win32" ? "msedge" : "");
  return chromium.launch({ headless: true, ...(channel ? { channel } : {}), ...options });
}
