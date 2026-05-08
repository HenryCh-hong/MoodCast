/**
 * Moodcast Sub-plan E visual review screenshots
 * Usage: node /tmp/moodcast-screenshots.mjs
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

async function waitForCompanion(page) {
  await page.waitForSelector('[aria-label="Open DJ companion"]', { timeout: 8000 });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// ─── 1. Collapsed companion: landing page ────────────────────────────────────
await page.goto(BASE, { waitUntil: 'networkidle' });
await waitForCompanion(page);
await shot(page, '01-collapsed-landing');

// ─── 2. Collapsed companion: builder page ────────────────────────────────────
await page.goto(`${BASE}/builder`, { waitUntil: 'networkidle' });
await waitForCompanion(page);
await shot(page, '02-collapsed-builder');

// ─── 3. Expanded companion: no session ───────────────────────────────────────
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(400);
await shot(page, '03-expanded-no-session');

// ─── 4. Theme system: all 5 themes (captured from expanded companion) ────────
const themes = ['morning', 'daylight', 'evening', 'midnight', 'terminal'];
for (const theme of themes) {
  // Click theme button by title
  const btn = page.locator(`[title="${theme}"]`).first();
  await btn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `04-theme-${theme}.png`), fullPage: false });
  console.log(`✓ 04-theme-${theme}`);
}

// Reset to midnight for remaining shots
await page.locator('[title="midnight"]').first().click();
await page.waitForTimeout(200);

// Close companion
await page.click('[aria-label="Collapse"]');
await page.waitForTimeout(200);

// ─── 5. Session page: load demo session ──────────────────────────────────────
// Get the demo session ID from the saved sessions or use the demo link
await page.goto(`${BASE}/session/demo-late-night`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot(page, '05-session-page-collapsed-companion');

// ─── 6. Expanded companion: session loaded ───────────────────────────────────
await waitForCompanion(page);
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(600);
await shot(page, '06-expanded-session-loaded');

// ─── 7. Companion: quick actions visible ─────────────────────────────────────
// Already expanded — take close crop of the companion panel
const companionPanel = page.locator('.fixed.bottom-4.right-4').last();
await companionPanel.screenshot({ path: path.join(OUT, '07-companion-quickactions-closeup.png') });
console.log('✓ 07-companion-quickactions-closeup');

// ─── 8. Ask DJ from companion ────────────────────────────────────────────────
const djInput = page.locator('input[placeholder="Ask the DJ..."]');
await djInput.fill('What is the vibe of this session?');
await page.waitForTimeout(200);
await shot(page, '08-companion-ask-dj-input');

// ─── 9. Header DJ controller with session ────────────────────────────────────
await shot(page, '09-header-dj-controller-session');

// Close companion to see header clearly
await page.click('[aria-label="Collapse"]');
await page.waitForTimeout(200);
await shot(page, '10-header-dj-controller-no-companion');

// ─── 10. Ask DJ on session page (panel) ──────────────────────────────────────
const sessionDJInput = page.locator('input[placeholder="Ask the DJ anything..."]');
await sessionDJInput.scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(OUT, '11-session-ask-dj-panel.png'), fullPage: false });
console.log('✓ 11-session-ask-dj-panel');

// ─── 11. Navigation: leave session, check companion clears ───────────────────
await page.goto(`${BASE}/builder`, { waitUntil: 'networkidle' });
await waitForCompanion(page);
await shot(page, '12-after-nav-companion-cleared');

// ─── 12. Mobile narrow width ─────────────────────────────────────────────────
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(BASE, { waitUntil: 'networkidle' });
await waitForCompanion(page);
await shot(page, '13-mobile-collapsed');
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(400);
await shot(page, '14-mobile-expanded');

// Reset viewport
await page.setViewportSize({ width: 1280, height: 800 });

// ─── 13. Saved sessions page: companion present ──────────────────────────────
await page.goto(`${BASE}/saved`, { waitUntil: 'networkidle' });
await waitForCompanion(page);
await shot(page, '15-saved-page-companion');

// ─── 14. Morning theme full page ─────────────────────────────────────────────
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(300);
await page.locator('[title="morning"]').first().click();
await page.waitForTimeout(400);
await page.click('[aria-label="Collapse"]');
await page.waitForTimeout(200);
await page.goto(`${BASE}/builder`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await shot(page, '16-morning-theme-builder-full');

// ─── 15. Terminal theme full page ────────────────────────────────────────────
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(300);
await page.locator('[title="terminal"]').first().click();
await page.waitForTimeout(400);
await page.click('[aria-label="Collapse"]');
await page.waitForTimeout(200);
await shot(page, '17-terminal-theme-builder');

// Reset to midnight
await page.click('[aria-label="Open DJ companion"]');
await page.waitForTimeout(300);
await page.locator('[title="midnight"]').first().click();
await page.waitForTimeout(300);
await page.click('[aria-label="Collapse"]');

await browser.close();

console.log(`\n✅ All screenshots saved to ${OUT}`);
console.log(fs.readdirSync(OUT).map(f => `  ${f}`).join('\n'));
