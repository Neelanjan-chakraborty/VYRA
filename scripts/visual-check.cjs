#!/usr/bin/env node
/**
 * Screenshots every tab of the exported web build at three viewport sizes and
 * fails on any page or console error.
 *
 *   pnpm --filter @vyra/mobile export:web
 *   pnpm visual-check [output-dir]
 *
 * Needs a Playwright installation with Chromium on the machine (present in the
 * Claude Code cloud container). It is a local QA aid, not part of CI.
 */
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../apps/mobile/dist');
const out = path.resolve(process.argv[2] ?? 'visual-check-output');
const PORT = 8099;
const TABS = ['Orbit', 'Discover', 'Connections', 'Messages', 'You'];
const VIEWPORTS = [
  ['small', 320, 568],
  ['phone', 390, 844],
  ['large', 820, 1180],
];
const TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('No web export found. Run: pnpm --filter @vyra/mobile export:web');
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((req, res) => {
  const requested = path.join(root, decodeURIComponent((req.url ?? '/').split('?')[0]));
  const inside = requested.startsWith(root) && fs.existsSync(requested);
  const file =
    inside && fs.statSync(requested).isFile() ? requested : path.join(root, 'index.html');
  res.setHeader('content-type', TYPES[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    for (const [name, width, height] of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });
      page.on('pageerror', (error) => errors.push(`[${name}] ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`[${name}] console: ${message.text()}`);
      });
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
      for (const tab of TABS) {
        await page.getByRole('tab', { name: tab }).click();
        await page.getByRole('tab', { name: tab, selected: true }).waitFor({ timeout: 5000 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        if (overflow) errors.push(`[${name}] ${tab}: horizontal overflow`);
        await page.screenshot({ path: path.join(out, `${tab.toLowerCase()}-${name}.png`) });
      }
      await page.close();
    }
  } catch (error) {
    errors.push(String(error));
  } finally {
    await browser.close();
    server.close();
  }
  if (errors.length > 0) {
    console.error(`Visual check failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
  console.log(`Visual check passed: ${TABS.length * VIEWPORTS.length} screenshots in ${out}`);
});
