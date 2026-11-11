const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'plugin');
const syncOnly = process.argv.includes('--sync-only');

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

ensurePlaceholder(appJs, '__INVOICE_TEMPLATE__', 'src/app.js');
ensurePlaceholder(template, '/* INLINE:styles */', 'src/index.template.html');
ensurePlaceholder(template, '<!-- INLINE:ui -->', 'src/index.template.html');
ensurePlaceholder(template, '/* INLINE:script */', 'src/index.template.html');
ensurePlaceholder(ui, '<!-- INLINE:LOGO -->', 'src/ui.html');

const uiWithLogo = ui.replace('<!-- INLINE:LOGO -->', () => logoSvg);

appJs = appJs.replace('__INVOICE_TEMPLATE__', () => invoiceTemplate.replace(/\r\n/g, '\n'));

// Bundle app.js together with its npm dependencies (e.g. the PDF libraries)
// into a single self-contained IIFE. The plugin ships as one index.html, so
// every dependency has to be inlined — nothing can be fetched at runtime.
let scriptBundle;
try {
  const result = esbuild.buildSync({
    stdin: {
      contents: appJs,
      loader: 'js',
      resolveDir: srcDir,
      sourcefile: 'app.js',
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    legalComments: 'none',
    logLevel: 'silent',
  });
  scriptBundle = result.outputFiles[0].text;
} catch (error) {
  console.error('Failed to bundle app.js with esbuild:', error.message);
  process.exit(1);
}

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

fs.writeFileSync(path.join(srcDir, 'index.html'), output, 'utf8');
console.log('Built index.html');

// Create dist directory if it doesn't exist
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Create zip file
const zipFileName = `invoice-maker-v${packageJson.version}.zip`;
const zipFilePath = path.join(distDir, zipFileName);

// Bundle the host-side plugin code (which carries the PDF libraries) into
// plugin.js. It has a 5 MB budget, unlike index.html's 100 KB cap.
const pluginSrcPath = path.join(srcDir, 'plugin.src.js');
const pluginJsPath = path.join(srcDir, 'plugin.js');
try {
  const result = esbuild.buildSync({
    entryPoints: [pluginSrcPath],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    minify: true,
    legalComments: 'none',
    logLevel: 'silent',
  });
  fs.writeFileSync(pluginJsPath, result.outputFiles[0].text, 'utf8');
  console.log(`Built plugin.js (${Math.round(result.outputFiles[0].text.length / 1024)}KB)`);
} catch (error) {
  console.error('Failed to bundle plugin.src.js with esbuild:', error.message);
  process.exit(1);
}

try {
  execSync(`zip -q -j "${zipFilePath}" manifest.json plugin.js index.html`, { cwd: srcDir, stdio: 'pipe' });
  console.log(`Built: ${zipFileName}`);
  // Remove the generated index.html and plugin.js after zipping
  fs.unlinkSync(path.join(srcDir, 'index.html'));
  fs.unlinkSync(pluginJsPath);
} catch (error) {
  console.error('Failed to create zip file:', error.message);
  process.exit(1);
}
