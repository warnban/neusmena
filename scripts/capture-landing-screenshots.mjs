/**
 * Захват скриншотов CRM для лендинга (реальный UI через /landing-preview).
 *
 *   npm run dev
 *   npm run capture:landing
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "landing");
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const PAGES = [
  { name: "dashboard", path: "/landing-preview/dashboard", wait: /Dashboard/i },
  { name: "bookings", path: "/landing-preview/bookings", wait: /Бронирования/i },
  { name: "guests", path: "/landing-preview/guests", wait: /База гостей/i },
  { name: "reports", path: "/landing-preview/reports", wait: /Отчёты/i },
  { name: "assistant", path: "/landing-preview/assistant", wait: /хомячок|помощник|Смена/i },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  for (const { name, path: route, wait } of PAGES) {
    console.log(`→ ${route}`);
    await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
    await page.getByText(wait).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    const file = path.join(OUT_DIR, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  ✓ ${file}`);
  }

  await browser.close();
  console.log("\nГотово. PNG в public/landing/ (опционально для статики).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
