/**
 * Fills dist/index.html's empty #root with server-rendered markup so the
 * static file has real, indexable content instead of a blank shell — the
 * <title>/meta/JSON-LD in index.html are already correct and checked into
 * the repo (this is a single-route app), so this script only needs to swap
 * the #root div. Runs after the client build and the SSR build of
 * entry-server.tsx.
 */
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const ssrDir = join(root, 'dist-ssr');

const ROOT_DIV = '<div id="root"></div>';

async function main() {
  const indexPath = join(distDir, 'index.html');
  const template = await readFile(indexPath, 'utf8');

  if (!template.includes(ROOT_DIV)) {
    throw new Error(
      'dist/index.html has no empty <div id="root"></div> to fill. Either it is ' +
        'already prerendered (this script rewrites dist/index.html in place, so ' +
        'run a fresh `vite build` before re-running it), or index.html changed ' +
        'shape and prerender.mjs needs updating to match.'
    );
  }

  const server = await import(pathToFileURL(join(ssrDir, 'entry-server.js')).href);
  const appHtml = server.render();

  // Replacer *function*, not a string: in a replacement string, '$&', '$`',
  // "$'" and '$1' are backreference patterns, so a literal '$' anywhere in
  // the rendered app markup would silently corrupt the output.
  const html = template.replace(ROOT_DIV, () => `<div id="root">${appHtml}</div>`);

  await writeFile(indexPath, html, 'utf8');
  console.log(`  prerendered / -> ${indexPath.replace(root, '.')}`);

  await rm(ssrDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('\nprerender failed:\n', err);
  process.exit(1);
});
