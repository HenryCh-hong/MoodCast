/**
 * Moodcast review screenshots — part 2
 * Covers: Ask DJ inputs, header controller, navigation, mobile
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:3001';
const OUT = '/tmp/moodcast-screens';
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`✓ ${name}`);
}

async function waitForCompanion(page, timeout = 5000) {
  await page.locator('[aria-label="Open DJ companion"]').first().waitFor({ timeout });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// ─── Session page with valid demo ────────────────────────────────────────────
await page.goto(`${BASE}/session/demo-debugging`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot(page, '08-session-page-with-demo');

// Companion should show session title in pill
await waitForCompanion(page);
await shot(page, '09-header-controller-with-session');

// Open companion
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(600);
await shot(page, '10-expanded-companion-with-session');

// Ask DJ input in companion
const djInput = page.locator('input[placeholder="Ask the DJ..."]').first();
if (await djInput.isVisible()) {
  await djInput.fill('What is the vibe right now?');
  await page.waitForTimeout(200);
  await shot(page, '11-companion-ask-dj-filled');
  // Submit the question (Enter)
  await djInput.press('Enter');
  await page.waitForTimeout(4000); // wait for AI response
  await shot(page, '12-companion-ask-dj-response');
} else {
  console.log('⚠ Ask DJ input not visible in companion');
  await shot(page, '11-companion-no-ask-dj');
}

// Close companion
const closeBtn = page.locator('[aria-label="Collapse"]');
if (await closeBtn.isVisible()) await closeBtn.click();
await page.waitForTimeout(200);

// ─── Ask DJ on session page panel ────────────────────────────────────────────
const sessionDJPanel = page.locator('text=Ask the DJ').first();
if (await sessionDJPanel.isVisible()) {
  await sessionDJPanel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot(page, '13-session-ask-dj-panel');
}

// ─── Navigation: leave session, check companion clears ───────────────────────
await page.goto(`${BASE}/builder`, { waitUntil: 'networkidle' });
await waitForCompanion(page);
await shot(page, '14-after-nav-to-builder-companion-clears');

// ─── Companion on saved sessions page ────────────────────────────────────────
await page.goto(`${BASE}/saved`, { waitUntil: 'networkidle' });
await waitForCompanion(page);
await shot(page, '15-saved-sessions-companion');

// ─── Mobile: 375px ───────────────────────────────────────────────────────────
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(`${BASE}/session/demo-study`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await shot(page, '16-mobile-session-companion-collapsed');

// Open on mobile
await waitForCompanion(page, 3000).catch(() => {});
const mobilePill = page.locator('[aria-label="Open DJ companion"]').first();
if (await mobilePill.isVisible()) {
  await mobilePill.click();
  await page.waitForTimeout(500);
  await shot(page, '17-mobile-companion-expanded');
  const closeBtn2 = page.locator('[aria-label="Collapse"]');
  if (await closeBtn2.isVisible()) await closeBtn2.click();
}

// NavDJController: hidden on mobile (not visible at 375px)
const navController = page.locator('[aria-label="Open DJ companion"].hidden');
const navText = await page.locator('header').textContent();
console.log('Nav header on mobile:', navText?.slice(0, 100));
await shot(page, '18-mobile-navbar-no-controller');

// ─── Desktop: verify header controller visible ────────────────────────────────
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(`${BASE}/session/demo-study`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await shot(page, '19-desktop-header-with-controller');

// ─── Evening theme full page ─────────────────────────────────────────────────
await waitForCompanion(page);
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(300);
const eveningBtn = page.locator('[title="evening"]').first();
await eveningBtn.click();
await page.waitForTimeout(500);
const closeBtn3 = page.locator('[aria-label="Collapse"]');
if (await closeBtn3.isVisible()) await closeBtn3.click();
await page.waitForTimeout(200);
await shot(page, '20-evening-glow-theme-session');

// Reset to midnight
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(200);
await page.locator('[title="midnight"]').first().click();
await page.waitForTimeout(200);

await browser.close();

console.log(`\n✅ Part 2 done. Screenshots in ${OUT}`);
console.log(fs.readdirSync(OUT).sort().map(f => `  ${f}`).join('\n'));
