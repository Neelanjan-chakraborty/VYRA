#!/usr/bin/env node
/**
 * Browser check of the built site: every page at phone and desktop width.
 * Fails on a console error, a failed request, horizontal overflow, a broken
 * image or a missing/duplicate H1, tries the mobile menu, and saves full-page
 * screenshots for a human to look at.
 *
 *   pnpm --filter @vyra/landing build && pnpm --filter @vyra/landing start &
 *   pnpm --filter @vyra/landing visual:check [base-url] [output-dir]
 *
 * Needs Playwright with Chromium on the machine. A local QA aid, like scripts/e2e-web.cjs.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const base = (process.argv[2] ?? 'http://localhost:3100').replace(/\/$/, '');
const out = path.resolve(process.argv[3] ?? 'visual-check-output');
const PAGES = [
  ['home', '/'],
  ['features', '/features'],
  ['how-it-works', '/how-it-works'],
  ['ai-persona', '/ai-persona'],
  ['compatibility', '/compatibility'],
  ['safety', '/safety'],
  ['about', '/about'],
  ['contact', '/contact'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
  ['not-found', '/no-such-page'],
];
const VIEWPORTS = [
  ['mobile', { width: 390, height: 844 }, 2],
  ['desktop', { width: 1440, height: 900 }, 1],
];
const only = process.env.ONLY?.split(',');

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const problems = [];

  for (const [device, viewport, deviceScaleFactor] of VIEWPORTS) {
    const context = await browser.newContext({ viewport, deviceScaleFactor });
    const page = await context.newPage();
    let current = '';
    page.on('pageerror', (error) => problems.push(`${current}: page error: ${error.message}`));
    page.on('console', (message) => {
      // The deliberate 404 logs one "failed to load resource" for the document itself.
      if (message.type() === 'error' && !current.includes('no-such-page'))
        problems.push(`${current}: console: ${message.text()}`);
    });
    page.on('requestfailed', (request) => {
      // Next.js cancels speculative prefetches when the page moves on; that is not a failure.
      if (request.failure()?.errorText !== 'net::ERR_ABORTED')
        problems.push(`${current}: request failed: ${request.url()}`);
    });

    for (const [name, route] of PAGES) {
      if (only && !only.includes(name)) continue;
      current = `${device} ${route}`;
      await page.goto(base + route, { waitUntil: 'networkidle' });

      // Walk the page so lazy images load and scroll-triggered content settles.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += Math.round(viewport.height * 0.6)) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(140);
      }
      await page.waitForTimeout(900);

      const report = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        h1: document.querySelectorAll('h1').length,
        broken: [...document.images]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src),
        hidden: [...document.querySelectorAll('[data-reveal]')].filter(
          (element) => Number(getComputedStyle(element).opacity) < 0.99,
        ).length,
      }));
      if (report.overflow > 0)
        problems.push(`${current}: overflows horizontally by ${report.overflow}px`);
      if (report.h1 !== 1) problems.push(`${current}: ${report.h1} h1 elements`);
      for (const src of report.broken) problems.push(`${current}: broken image ${src}`);
      if (report.hidden > 0)
        problems.push(`${current}: ${report.hidden} revealed blocks still hidden`);

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, `${device}-${name}.png`), fullPage: true });
      if (name === 'home' || name === 'features')
        await page.screenshot({ path: path.join(out, `${device}-${name}-fold.png`) });
    }

    if (device === 'mobile' && !only) {
      current = 'mobile menu';
      await page.goto(base + '/', { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('navigation', { name: 'Menu' }).waitFor();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, 'mobile-menu.png') });
      await page.keyboard.press('Escape');
      await page.getByRole('navigation', { name: 'Menu' }).waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Open menu' }).click();
      await page
        .getByRole('navigation', { name: 'Menu' })
        .getByRole('link', { name: 'Compatibility' })
        .click();
      await page.waitForURL('**/compatibility');
      await page.getByRole('navigation', { name: 'Menu' }).waitFor({ state: 'detached' });
    }
    await context.close();
  }

  // Reduced motion: nothing may stay hidden waiting for an animation.
  if (!only) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    const animating = await page.evaluate(
      () =>
        document.getAnimations().filter((animation) => animation.playState === 'running').length,
    );
    if (animating > 0) problems.push(`reduced motion: ${animating} animations still running`);
    await context.close();
  }

  await browser.close();
  if (problems.length > 0) {
    console.error(`Visual check found problems:\n  - ${problems.join('\n  - ')}`);
    process.exit(1);
  }
  console.log(`Visual check passed. Screenshots in ${out}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
