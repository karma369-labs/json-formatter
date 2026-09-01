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

const MEDIA_QUERY = '(prefers-color-scheme: light)';

/**
 * index.html carries an inline pre-paint theme script that necessarily
 * duplicates logic that also lives in TypeScript, because it must run before
 * any module loads and so cannot import anything (see the comment above that
 * script in index.html). Nothing else catches drift between the two copies:
 * tsc doesn't type-check string literals inside HTML, eslint doesn't look at
 * HTML, and setting `data-theme` imperatively means React never renders or
 * diffs it, so a mismatch produces no hydration warning — only a silent
 * flash of the wrong theme for a returning visitor. This guard fails the
 * build instead of shipping that regression quietly.
 */
async function checkThemeConsistency(template) {
  const storagePath = join(root, 'src', 'lib', 'storage.ts');
  const themeContextPath = join(root, 'src', 'contexts', 'theme-context.ts');
  const [storageSrc, themeContextSrc] = await Promise.all([
    readFile(storagePath, 'utf8'),
    readFile(themeContextPath, 'utf8'),
  ]);

  const themeKeyMatch = storageSrc.match(/THEME_KEY\s*=\s*'([^']+)'/);
  if (!themeKeyMatch) {
    throw new Error(
      `Could not find THEME_KEY in ${storagePath.replace(root, '.')} with the ` +
        "pattern /THEME_KEY\\s*=\\s*'([^']+)'/. This guard exists to catch drift " +
        "between that constant and the hardcoded key literal in index.html's " +
        'inline pre-paint theme script — if THEME_KEY was renamed or reformatted, ' +
        'update the regex in prerender.mjs\'s checkThemeConsistency() to match, ' +
        "rather than letting this check silently pass."
    );
  }
  const themeKey = themeKeyMatch[1];

  if (!template.includes(themeKey)) {
    throw new Error(
      `dist/index.html's inline pre-paint theme script does not contain the ` +
        `key "${themeKey}", but that is THEME_KEY in ` +
        `${storagePath.replace(root, '.')}. The inline script in index.html and ` +
        'THEME_KEY have drifted apart — the script must run before any module ' +
        'loads, so it hardcodes its own copy of the key, and the two copies ' +
        'must be updated together. Fix the literal in the <script> near the ' +
        'top of index.html to match THEME_KEY.'
    );
  }

  if (!themeContextSrc.includes(MEDIA_QUERY)) {
    throw new Error(
      `Could not find the media query "${MEDIA_QUERY}" in ` +
        `${themeContextPath.replace(root, '.')}. This guard expects readTheme() ` +
        'there to fall back to that exact media query string, matching the ' +
        "inline pre-paint theme script in index.html — if the resolution rule " +
        'changed, update the MEDIA_QUERY constant in prerender.mjs to match, ' +
        'rather than letting this check silently pass.'
    );
  }

  if (!template.includes(MEDIA_QUERY)) {
    throw new Error(
      `dist/index.html's inline pre-paint theme script does not contain the ` +
        `media query "${MEDIA_QUERY}", but readTheme() in ` +
        `${themeContextPath.replace(root, '.')} falls back to that exact query. ` +
        'The inline script in index.html and readTheme() have drifted apart — ' +
        'the script must run before any module loads, so it hardcodes its own ' +
        'copy of the resolution rule, and the two copies must be updated ' +
        'together. Fix the media-query literal in the <script> near the top of ' +
        'index.html to match readTheme().'
    );
  }
}

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

  await checkThemeConsistency(template);

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
