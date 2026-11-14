#!/usr/bin/env node
/**
 * Renders the raster icons from src/app/icon.svg: the Apple touch icon, the
 * .ico favicon and the logo referenced by the Organization structured data.
 * Run after changing the mark. Needs Playwright with Chromium on the machine.
 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const app = path.resolve(__dirname, '../src/app');
const svg = fs.readFileSync(path.join(app, 'icon.svg'), 'utf8');

/** A .ico file that wraps one PNG, which every current browser accepts. */
function icoFromPng(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(size, 6);
  header.writeUInt8(size, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

(async () => {
  const browser = await chromium.launch();
  const render = async (size, square) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    // Apple and the logo get square corners; the platform applies its own mask.
    const source = square ? svg.replace('rx="12"', 'rx="0"') : svg;
    await page.setContent(
      `<body style="margin:0;background:transparent">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`,
    );
    const png = await page.screenshot({ omitBackground: true });
    await page.close();
    return png;
  };
  fs.writeFileSync(path.join(app, 'apple-icon.png'), await render(180, true));
  fs.writeFileSync(path.join(app, 'favicon.ico'), icoFromPng(await render(48, false), 48));
  fs.writeFileSync(path.resolve(__dirname, '../public/logo.png'), await render(512, true));
  await browser.close();
  console.log('Wrote apple-icon.png, favicon.ico and public/logo.png');
})();
