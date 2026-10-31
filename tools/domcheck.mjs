// Cross-checks the IDs/classes the UI code reaches for against index.html
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const cssClasses = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));

const wanted = new Set();
const add = (raw) => {
  const id = raw.replace(/^#/, '').split(/\s+/)[0];
  if (/^[\w-]+$/.test(id) && !['button', 'canvas', 'div', 'span'].includes(id)) wanted.add(id);
};
for (const m of ui.matchAll(/(?:getElementById|\$|byId)\(\s*['"]([^'"]+)['"]/g)) add(m[1]);
for (const m of ui.matchAll(/querySelector(?:All)?\(\s*['"]#([\w-]+)/g)) add(m[1]);
for (const m of main.matchAll(/(?:getElementById|\$|byId)\(\s*['"]([^'"]+)['"]/g)) add(m[1]);

const missing = [...wanted].filter((id) => !htmlIds.has(id)).sort();
// class names referenced through classList / className strings
const usedClasses = new Set();
for (const m of ui.matchAll(/classList\.(?:add|remove|toggle)\(\s*['"]([^'"]+)['"]/g)) usedClasses.add(m[1]);
for (const m of ui.matchAll(/querySelectorAll?\(\s*['"]\.([\w-]+)/g)) usedClasses.add(m[1]);
const missingClasses = [...usedClasses].filter((c) => !cssClasses.has(c) && !html.includes(`class="${c}`) && !html.includes(` ${c}`)).sort();

console.log(`html ids: ${htmlIds.size}  ui ids referenced: ${wanted.size}`);
console.log(missing.length ? `✗ missing ids: ${missing.join(', ')}` : '✓ every id referenced by the UI exists in index.html');
console.log(missingClasses.length ? `✗ classes with no styles/html: ${missingClasses.join(', ')}` : '✓ every class used by the UI is styled');
process.exit(missing.length ? 1 : 0);
