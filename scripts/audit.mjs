import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dirname, '..'));
async function files(path) {
  return (await Promise.all((await readdir(path, { withFileTypes: true })).map(async entry =>
    entry.isDirectory() ? files(`${path}/${entry.name}`) : [`${path}/${entry.name}`]))).flat();
}
const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage', 'activeTab']);
assert.equal(manifest.host_permissions, undefined);
assert.equal(manifest.externally_connectable, undefined);
assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
const referenced = [manifest.background.service_worker, manifest.action.default_popup, manifest.options_ui.page,
  ...manifest.content_scripts.flatMap(script => [...script.js, ...script.css])];
for (const file of referenced) assert.ok((await readFile(`dist/${file}`)).length, `${file} is missing`);
for (const file of await files('src')) {
  const text = await readFile(file, 'utf8');
  assert.doesNotMatch(text, /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\()/, `Network API in ${file}`);
  if (!file.endsWith('platform/chromium.ts')) assert.doesNotMatch(text, /\bchrome\s*\./, `Scattered native API in ${file}`);
  if (file.startsWith('src/core/')) assert.doesNotMatch(text, /\b(document|window|HTMLElement|chrome)\b/, `Platform/DOM coupling in ${file}`);
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
