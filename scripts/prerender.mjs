/**
 * Prerenders one static HTML file per route (see src/routes.ts) so every tool
 * has its own crawlable URL with real content and its own <head>, instead of a
 * single blank shell. dist/index.html (built by Vite) is the template: for
 * each route this fills its #root with that route's server-rendered markup and
 * rewrites the per-route head fields (title, description, canonical, OpenGraph,
 * Twitter, JSON-LD), then writes dist/<path>/index.html. Apache serves each
 * nested index.html natively via DirectoryIndex, so no server code is needed.
 *
 * Runs after the client build and the SSR build of entry-server.tsx. The route
 * table is read off that compiled SSR bundle (entry-server re-exports it) so
 * this script and the app never keep separate route lists.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

/** Escape a string for use in an HTML attribute value or text node. */
function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Rewrite the head's per-route fields on a copy of the template. Uses
 *  attribute-anchored regexes (the template head is stable and checked in) so
 *  it doesn't depend on the home route's exact copy staying constant. */
function applyHead(template, route, origin) {
  const url = route.path === '/' ? `${origin}/` : `${origin}${route.path}`;
  const title = esc(route.title);
  const desc = esc(route.description);

  const jsonLd = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: route.h1,
      url,
      description: route.description,
      image: `${origin}/og-image.png`,
      screenshot: `${origin}/og-image.png`,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    null,
    2
  );

  const swaps = [
    [/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`],
    [/(<meta name="description" content=")[\s\S]*?(")/, `$1${desc}$2`],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(url)}$2`],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`],
    [/(<meta property="og:title" content=")[\s\S]*?(")/, `$1${title}$2`],
    [/(<meta property="og:description" content=")[\s\S]*?(")/, `$1${desc}$2`],
    [/(<meta name="twitter:title" content=")[\s\S]*?(")/, `$1${title}$2`],
    [/(<meta name="twitter:description" content=")[\s\S]*?(")/, `$1${desc}$2`],
    [
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">\n${jsonLd}\n    </script>`,
    ],
  ];

  let html = template;
  for (const [pattern, replacement] of swaps) {
    if (!pattern.test(html)) {
      throw new Error(
        `prerender: head pattern ${pattern} did not match dist/index.html. The ` +
          'template head changed shape — update applyHead() in prerender.mjs to ' +
          'match, rather than shipping pages with the wrong per-route metadata.'
      );
    }
    // Function replacer: '$1'/'$2' are our own backreferences (safe), but the
    // injected values are pre-escaped and contain no '$' patterns.
    html = html.replace(pattern, replacement);
  }
  return html;
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
  const { ROUTES, SITE_ORIGIN } = server;

  for (const route of ROUTES) {
    const appHtml = server.render(route.path);

    // Replacer *function* for #root, not a string: '$&', '$`', "$'" and '$1'
    // are backreference patterns in a replacement string, so a literal '$'
    // anywhere in the rendered app markup would silently corrupt the output.
    const withHead = applyHead(template, route, SITE_ORIGIN);
    const html = withHead.replace(ROOT_DIV, () => `<div id="root">${appHtml}</div>`);

    // '/' -> dist/index.html; '/validator' -> dist/validator/index.html;
    // '/converter/json-to-yaml' -> dist/converter/json-to-yaml/index.html.
    const outPath =
      route.path === '/'
        ? indexPath
        : join(distDir, route.path.replace(/^\//, ''), 'index.html');
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html, 'utf8');
    console.log(`  prerendered ${route.path} -> ${outPath.replace(root, '.')}`);
  }

  // Regenerate sitemap.xml from the same route table so it can't drift from the
  // pages that actually exist. Overwrites the placeholder Vite copied from
  // public/ into dist/.
  const urls = ROUTES.map((r) => {
    const loc = r.path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${r.path}`;
    const priority = r.path === '/' ? '1.0' : '0.8';
    return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  }).join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  const sitemapPath = join(distDir, 'sitemap.xml');
  await writeFile(sitemapPath, sitemap, 'utf8');
  console.log(`  wrote sitemap -> ${sitemapPath.replace(root, '.')} (${ROUTES.length} urls)`);

  await rm(ssrDir, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('\nprerender failed:\n', err);
  process.exit(1);
});
