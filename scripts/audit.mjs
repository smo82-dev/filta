import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dirname, '..'));
async function files(path) {
  return (await Promise.all((await readdir(path, { withFileTypes: true })).map(async entry =>
    entry.isDirectory() ? files(`${path}/${entry.name}`) : [`${path}/${entry.name}`]))).flat();
}
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
assert.equal(manifest.version, pkg.version);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.externally_connectable, undefined);
assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const size of [16, 32, 48, 128]) {
  const path = `icons/icon-${size}.png`;
  assert.equal(manifest.icons[size], path); assert.equal(manifest.action.default_icon[size], path);
  const bytes = await readFile(`dist/${path}`);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), size); assert.equal(bytes.readUInt32BE(20), size);
  assert.equal(digest(bytes), digest(await readFile(`branding/icon-${size}.png`)), 'Original icon bytes must be preserved');
}
for (const name of ['original-store-icon-128.png', 'original-fullsize-logo-1254.png']) {
  assert.equal(digest(await readFile(`branding/${name}`)), digest(await readFile(name)), 'Owner source artwork changed');
}
assert.equal(digest(await readFile('dist/icons/logo.png')), digest(await readFile('branding/original-store-icon-128.png')));
for (const page of ['popup.html', 'settings.html']) {
  const html = await readFile(`dist/${page}`, 'utf8');
  assert.match(html, /src="icons\/logo.png"/);
  assert.doesNotMatch(html, />N<\//);
}
const referenced = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page,
  ...manifest.content_scripts.flatMap(script => [...script.js, ...script.css])];
for (const file of referenced) assert.ok((await readFile(`dist/${file}`)).length, `${file} is missing`);
for (const file of await files('src')) {
  const text = await readFile(file, 'utf8');
  assert.doesNotMatch(text, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\()/, `Network API in ${file}`);
  if (!file.endsWith('platform/chromium.ts')) assert.doesNotMatch(text, /\bchrome\s*\./, `Scattered native API in ${file}`);
  if (file.startsWith('src/core/')) {
    const syntax = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const forbidden = new Set(['document', 'window', 'HTMLElement', 'chrome']);
    const visit = node => {
      if (ts.isIdentifier(node)) assert.ok(!forbidden.has(node.text), `Platform/DOM coupling in ${file}: ${node.text}`);
      ts.forEachChild(node, visit);
    };
    visit(syntax);
  }
}
for (const file of await files('dist')) {
  if (!/\.(js|css|html)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  assert.doesNotMatch(text, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\()/, `Network dependency in ${file}`);
  assert.doesNotMatch(text, /(?:src|href)\s*=\s*["'](?:https?:)?\/\//, `External asset in ${file}`);
  assert.doesNotMatch(text, /@import\b|url\(\s*["']?https?:/i, `External CSS in ${file}`);
  assert.doesNotMatch(text, /eval\s*\(|new Function\s*\(/, `Dynamic executable code in ${file}`);
}
console.log('Package audit passed: MV3 files, minimal permissions, isolated APIs, portable core, no network APIs/assets/eval.');
