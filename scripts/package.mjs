import { deflateRawSync } from 'node:zlib';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dirname, '..'));
// Small ZIP writer: no extra packaging dependency. UTF-8 names, DEFLATE, CRC-32.
const table = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
async function collect(dir, prefix = '') {
  const entries = [];
  for (const item of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${dir}/${item.name}`, name = `${prefix}${item.name}`;
    if (item.isDirectory()) entries.push(...await collect(path, `${name}/`));
    else entries.push({ name, bytes: await readFile(path) });
  }
  return entries;
}
const locals = [], central = [];
let offset = 0;
const entries = await collect('dist');
for (const entry of entries) {
  const name = Buffer.from(entry.name), compressed = deflateRawSync(entry.bytes), crc = crc32(entry.bytes);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
  local.writeUInt16LE(8, 8); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(entry.bytes.length, 22); local.writeUInt16LE(name.length, 26);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x800, 8); header.writeUInt16LE(8, 10); header.writeUInt16LE(33, 14);
  header.writeUInt32LE(crc, 16); header.writeUInt32LE(compressed.length, 20); header.writeUInt32LE(entry.bytes.length, 24);
  header.writeUInt16LE(name.length, 28); header.writeUInt32LE(offset, 42);
  locals.push(local, name, compressed); central.push(header, name); offset += local.length + name.length + compressed.length;
}
const centralBytes = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16);
await mkdir('release', { recursive: true });
await writeFile('release/news-filter-0.1.0.zip', Buffer.concat([...locals, centralBytes, end]));
console.log('Created release/news-filter-0.1.0.zip (manifest at ZIP root).');
