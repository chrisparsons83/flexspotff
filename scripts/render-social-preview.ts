/**
 * Saves the Foundations/Logo SocialPreview story as the link preview image.
 * Needs Storybook running (`npm run storybook`); pass another URL to use a
 * different one.
 *
 *   npm run render:social-preview [storybook-url]
 */
import { chromium } from 'playwright';

const storybook = process.argv[2] ?? 'http://localhost:6006';
const OUT = 'public/social-preview.png';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(
  `${storybook}/iframe.html?id=foundations-logo--social-preview&viewMode=story`,
  { waitUntil: 'networkidle' },
);
await page.evaluate(() => document.fonts.ready);
await page.locator('#social-preview').screenshot({ path: OUT });
await browser.close();
console.log(`Wrote ${OUT}`);
