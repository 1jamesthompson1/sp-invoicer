const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'plugin');
const distDir = path.join(rootDir, 'dist');
const buildDir = path.join(distDir, 'build');
const syncOnly = process.argv.includes('--sync-only');

// Super Productivity rejects plugin assets over these sizes.
// See MAX_PLUGIN_* in the app's src/app/plugins/plugin.const.ts.
const LIMITS = {
  indexHtml: 1 * 1024 * 1024,
  pluginJs: 5 * 1024 * 1024,
  zip: 10 * 1024 * 1024
};

// Sync metadata from package.json to manifest.json
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(srcDir, 'manifest.json'), 'utf8'));

let manifestUpdated = false;

if (manifest.version !== packageJson.version) {
  manifest.version = packageJson.version;
  manifestUpdated = true;
}

if (manifest.description !== packageJson.description) {
  manifest.description = packageJson.description;
  manifestUpdated = true;
}

if (manifest.author !== packageJson.author) {
  manifest.author = packageJson.author;
  manifestUpdated = true;
}

if (manifest.homepage !== packageJson.homepage) {
  manifest.homepage = packageJson.homepage;
  manifestUpdated = true;
}

if (manifestUpdated) {
  fs.writeFileSync(path.join(srcDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('Updated manifest.json with package.json metadata');
}

if (syncOnly) {
  console.log('Sync complete (--sync-only mode)');
  process.exit(0);
}

function readSrc(fileName) {
  return fs.readFileSync(path.join(srcDir, fileName), 'utf8');
}

function ensurePlaceholder(content, placeholder, fileName) {
  if (!content.includes(placeholder)) {
    throw new Error(`Missing placeholder ${placeholder} in ${fileName}`);
  }
}

function formatKb(bytes) {
  return `${Math.round(bytes / 1024)}KB`;
}

function assertWithinLimit(label, bytes, limit) {
  if (bytes > limit) {
    console.error(`${label} is ${formatKb(bytes)}, over the ${formatKb(limit)} limit.`);
    process.exit(1);
  }
}

// Shared by the inline UI bundle and the host-side plugin.js bundle.
function bundle(options) {
  try {
    const result = esbuild.buildSync({
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: ['es2020'],
      minify: true,
      legalComments: 'none',
      logLevel: 'silent',
      ...options
    });
    return result.outputFiles[0].text;
  } catch (error) {
    console.error('esbuild failed:', error.message);
    process.exit(1);
  }
}

const template = readSrc('index.template.html');
const styles = readSrc('styles.css');
const ui = readSrc('ui.html');
let appJs = readSrc('app.js');
const invoiceTemplate = readSrc('invoice-template.html');

const logoPath = path.join(rootDir, 'docs', 'logo.svg');
const logoSvg = fs.readFileSync(logoPath, 'utf8')
  .replace(/\s*\n\s*/g, ' ')
  .replace(/>\s+</g, '><')
  .replace(/\s{2,}/g, ' ')
  .trim();

ensurePlaceholder(appJs, '__INVOICE_TEMPLATE__', 'plugin/app.js');
ensurePlaceholder(template, '/* INLINE:styles */', 'plugin/index.template.html');
ensurePlaceholder(template, '<!-- INLINE:ui -->', 'plugin/index.template.html');
ensurePlaceholder(template, '/* INLINE:script */', 'plugin/index.template.html');
ensurePlaceholder(ui, '<!-- INLINE:LOGO -->', 'plugin/ui.html');

const uiWithLogo = ui.replace('<!-- INLINE:LOGO -->', () => logoSvg);

appJs = appJs.replace('__INVOICE_TEMPLATE__', () => invoiceTemplate.replace(/\r\n/g, '\n'));

// Bundle the UI script into a self-contained IIFE. The plugin ships as one
// index.html, so anything it imports has to be inlined.
const scriptBundle = bundle({
  stdin: {
    contents: appJs,
    loader: 'js',
    resolveDir: srcDir,
    sourcefile: 'app.js'
  }
});

// A literal `</script` inside the inlined bundle would prematurely close the
// host <script> tag in index.html. Escaping it to `<\/script` is a no-op
// inside JS strings/regex/template literals and comments, so it is always safe.
const inlinedScript = scriptBundle.replace(/<\/script/gi, '<\\/script');

const output = template
  // Function replacers: a string replacement would interpret `$&`, `$$`, etc.
  // in the inlined content, corrupting both the bundle and the invoice template.
  .replace('/* INLINE:styles */', () => styles.trimEnd())
  .replace('<!-- INLINE:ui -->', () => uiWithLogo.trimEnd())
  .replace('/* INLINE:script */', () => inlinedScript.trimEnd())
  .trimEnd() + '\n';

// Bundle the host-side plugin code (which carries jsPDF) into plugin.js.
// It runs in the app renderer and has its own 5 MB budget.
const pluginBundle = bundle({
  entryPoints: [path.join(srcDir, 'plugin.src.js')]
});

// Stage the release assets in dist/build, leaving the source tree untouched.
fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

assertWithinLimit('index.html', Buffer.byteLength(output), LIMITS.indexHtml);
fs.writeFileSync(path.join(buildDir, 'index.html'), output, 'utf8');
console.log(`Built index.html (${formatKb(Buffer.byteLength(output))})`);

assertWithinLimit('plugin.js', Buffer.byteLength(pluginBundle), LIMITS.pluginJs);
fs.writeFileSync(path.join(buildDir, 'plugin.js'), pluginBundle, 'utf8');
console.log(`Built plugin.js (${formatKb(Buffer.byteLength(pluginBundle))})`);

fs.copyFileSync(path.join(srcDir, 'manifest.json'), path.join(buildDir, 'manifest.json'));

// Create the distributable zip from the staged assets.
const zipFileName = `invoice-maker-v${packageJson.version}.zip`;
const zipFilePath = path.join(distDir, zipFileName);
fs.rmSync(zipFilePath, { force: true });

try {
  execSync(`zip -q -j "${zipFilePath}" manifest.json plugin.js index.html`, { cwd: buildDir, stdio: 'pipe' });
} catch (error) {
  console.error('Failed to create zip file:', error.message);
  process.exit(1);
}

const zipSize = fs.statSync(zipFilePath).size;
assertWithinLimit('zip', zipSize, LIMITS.zip);
console.log(`Built: ${zipFileName} (${formatKb(zipSize)})`);
