const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

ensurePlaceholder(appJs, '__INVOICE_TEMPLATE__', 'src/app.js');
ensurePlaceholder(template, '/* INLINE:styles */', 'src/index.template.html');
ensurePlaceholder(template, '<!-- INLINE:ui -->', 'src/index.template.html');
ensurePlaceholder(template, '/* INLINE:script */', 'src/index.template.html');

appJs = appJs.replace('__INVOICE_TEMPLATE__', invoiceTemplate.replace(/\r\n/g, '\n'));

const output = template
  .replace('/* INLINE:styles */', styles.trimEnd())
  .replace('<!-- INLINE:ui -->', ui.trimEnd())
  .replace('/* INLINE:script */', appJs.trimEnd())
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

try {
  execSync(`zip -q -j "${zipFilePath}" manifest.json plugin.js index.html`, { cwd: srcDir, stdio: 'pipe' });
  console.log(`Built: ${zipFileName}`);
  // Remove the generated index.html after zipping
  fs.unlinkSync(path.join(srcDir, 'index.html'));
} catch (error) {
  console.error('Failed to create zip file:', error.message);
  process.exit(1);
}
