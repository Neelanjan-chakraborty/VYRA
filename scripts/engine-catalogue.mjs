// Writes the persona catalogue the Rust engine uses for explanation labels, so
// TypeScript (packages/validation) stays the single source of truth.
// Usage: node scripts/engine-catalogue.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { PERSONA_ATTRIBUTES } from '../packages/validation/dist/index.js';

const target = new URL('../crates/vyra-engine/src/catalogue.json', import.meta.url);
const json = `${JSON.stringify(PERSONA_ATTRIBUTES, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== json) {
    console.error(
      'crates/vyra-engine/src/catalogue.json is out of date: run pnpm engine:catalogue',
    );
    process.exit(1);
  }
} else {
  writeFileSync(target, json);
}
