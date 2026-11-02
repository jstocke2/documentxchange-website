import { build, createServer } from 'vite';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import websiteConfig from '../vite.website.config.mjs';

const source = resolve('website');
const output = resolve('dist-website');

await build(websiteConfig);

// Build the first authenticated-workspace React slice independently so the
// established portal can continue loading its non-React behavior unchanged.
// A manifest lets the copied portal HTML reference the content-hashed entry.
const portalManifestPath = resolve(output, 'portal-manifest.json');
await build({
  ...websiteConfig,
  build: {
    ...websiteConfig.build,
    emptyOutDir: false,
    manifest: 'portal-manifest.json',
    rollupOptions: {
      input: resolve('website-react/src/portal-main.jsx'),
      output: {
        entryFileNames: 'assets/portal-react-[hash].js',
        chunkFileNames: 'assets/portal-chunk-[hash].js',
        assetFileNames: 'assets/portal-[hash][extname]',
      },
    },
  },
});
const portalManifest = JSON.parse(await readFile(portalManifestPath, 'utf8'));
const portalEntry = Object.values(portalManifest).find((entry) => entry.isEntry);
if (!portalEntry?.file) throw new Error('The portal React entry was not emitted');

// Pre-render the React homepage into the production HTML. Search engines and
// link preview crawlers receive the complete semantic content immediately;
// React hydrates the same markup in the browser for interactivity.
const ssrServer = await createServer({
  ...websiteConfig,
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
});
try {
  const { render } = await ssrServer.ssrLoadModule('/src/entry-server.jsx');
  const indexPath = resolve(output, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf8');
  await writeFile(indexPath, indexHtml.replace('<div id="root"></div>', `<div id="root">${render()}</div>`));
} finally {
  await ssrServer.close();
}

// The marketing homepage is React. Preserve the existing application, checkout,
// support, and legal endpoints while those feature-heavy routes are migrated.
for (const path of [
  '_headers',
  'account.html',
  'checkout.css',
  'checkout.html',
  'checkout.js',
  'dmca.html',
  'founder.html',
  'portal.css',
  'portal.html',
  'portal.js',
  'privacy.html',
  'public-record-requests.html',
  'robots.txt',
  'site.webmanifest',
  'sitemap.xml',
  'styles.css',
  'support.html',
  'terms.html',
]) {
  await cp(resolve(source, path), resolve(output, path), { recursive: true });
}

// Keep /portal.js for direct source previews and any existing static consumers,
// but make built HTML load an immutable, content-addressed copy. This prevents
// a freshly deployed portal.html from pairing with a stale cached session gate
// that predates the React marketplace mount event.
const legacyPortalScript = await readFile(resolve(source, 'portal.js'), 'utf8');
const legacyPortalHash = createHash('sha256').update(legacyPortalScript).digest('hex').slice(0, 12);
const legacyPortalEntry = `assets/portal-legacy-${legacyPortalHash}.js`;
await mkdir(resolve(output, 'assets'), { recursive: true });
await writeFile(resolve(output, legacyPortalEntry), legacyPortalScript);
const checkoutScript = await readFile(resolve(source, 'checkout.js'), 'utf8');
const checkoutHash = createHash('sha256').update(checkoutScript).digest('hex').slice(0, 12);
const checkoutEntry = `assets/checkout-${checkoutHash}.js`;
await writeFile(resolve(output, checkoutEntry), checkoutScript);

const replaceLegacyPortalEntry = (html, pageName) => {
  const fixedPortalEntry = /<script\s+src=(["'])\/portal\.js(?:\?[^"']*)?\1><\/script>/;
  if (!fixedPortalEntry.test(html)) {
    throw new Error(`The fixed portal.js entry is missing from ${pageName}`);
  }
  return html.replace(fixedPortalEntry, `<script src="/${legacyPortalEntry}"></script>`);
};

const portalPath = resolve(output, 'portal.html');
const portalHtml = await readFile(portalPath, 'utf8');
if (!portalHtml.includes('<!-- PORTAL_REACT_ENTRY -->')) {
  throw new Error('The portal React entry placeholder is missing');
}
await writeFile(
  portalPath,
  replaceLegacyPortalEntry(
    portalHtml.replace('<!-- PORTAL_REACT_ENTRY -->', `<script type="module" src="/${portalEntry.file}"></script>`),
    'portal.html',
  ),
);

const accountPath = resolve(output, 'account.html');
const accountHtml = await readFile(accountPath, 'utf8');
await writeFile(accountPath, replaceLegacyPortalEntry(accountHtml, 'account.html'));

const checkoutPath = resolve(output, 'checkout.html');
const checkoutHtml = await readFile(checkoutPath, 'utf8');
if (!checkoutHtml.includes('<script src="/checkout-live.js"></script>')) {
  throw new Error('The fixed checkout script entry is missing from checkout.html');
}
await writeFile(
  checkoutPath,
  checkoutHtml.replace('<script src="/checkout-live.js"></script>', `<script src="/${checkoutEntry}"></script>`),
);
await unlink(portalManifestPath);

for (const screenshot of [
  'jake-stocker-founder-v1.jpg',
  'documentxchange-explore-marketing-v2.png',
  'documentxchange-request-marketing-v2.png',
  'documentxchange-contribute-marketing-v2.png',
]) {
  await cp(resolve(source, 'assets', screenshot), resolve(output, 'assets', screenshot));
}

await cp(resolve('assets/images/documentxchange-app-icon-v2.png'), resolve(output, 'documentxchange-icon.png'));
await cp(resolve('assets/images/franklin-county-protected-preview-v1.webp'), resolve(output, 'franklin-county-protected-preview-v1.webp'));
await cp(resolve(source, 'assets/facebook-cover.png'), resolve(output, 'documentxchange-social-preview.png'));
await cp(resolve(source, 'projects'), resolve(output, 'projects'), { recursive: true });

// Compile the React Facts portfolio project as its own small Vite application.
// Its emitted assets remain scoped to the project route and do not affect the
// main DocumentXchange application bundles.
await build({
  ...websiteConfig,
  root: resolve(source, 'projects/react-facts'),
  base: './',
  build: {
    outDir: resolve(output, 'projects/react-facts'),
    emptyOutDir: true,
    sourcemap: true,
  },
});

// PDF.js runs entirely in the browser so a seller's PDF is converted into
// page images before the existing OCR/validation upload pipeline receives it.
// Vendor the pinned package into the static build instead of loading runtime
// code from a third-party CDN.
const pdfJsOutput = resolve(output, 'vendor/pdfjs');
await mkdir(pdfJsOutput, { recursive: true });
await cp(resolve('node_modules/pdfjs-dist/build/pdf.mjs'), resolve(pdfJsOutput, 'pdf.mjs'));
await cp(resolve('node_modules/pdfjs-dist/build/pdf.worker.mjs'), resolve(pdfJsOutput, 'pdf.worker.mjs'));

// Publish the same complete state/county catalog used by the native apps.
// Generating this browser asset at build time keeps one source of truth and
// prevents request forms from being limited to locations already in the DB.
const countyCatalogSource = await readFile(resolve('constants/usCounties.ts'), 'utf8');
const countyCatalog = countyCatalogSource.replace(
  'export const US_COUNTIES: Record<string, string[]> = ',
  'window.US_COUNTIES = ',
);
if (countyCatalog === countyCatalogSource) {
  throw new Error('Could not convert constants/usCounties.ts for the website build');
}
await writeFile(resolve(output, 'us-counties.js'), countyCatalog);

// Keep standalone pages intact while publishing CSP-safe external stylesheets.
// Inline styles are intentionally excluded by the production Content Security
// Policy, so every page-specific stylesheet must be extracted during the build.
for (const page of ['privacy', 'support', 'public-record-requests']) {
  const htmlPath = resolve(output, `${page}.html`);
  const html = await readFile(htmlPath, 'utf8');
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);

  if (!styleMatch) {
    throw new Error(`Expected an inline stylesheet in ${page}.html`);
  }

  await writeFile(resolve(output, `${page}.css`), styleMatch[1].trimStart());
  await writeFile(
    htmlPath,
    html.replace(styleMatch[0], `<link rel="stylesheet" href="/${page}.css">`),
  );
}

console.log(`DocumentXchange website built at ${output}`);
