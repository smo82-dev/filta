import { readFile } from 'node:fs/promises';
import { createHash, createPublicKey, verify, constants } from 'node:crypto';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dirname, '..'));
const bytes = await readFile('release/news-filter-0.1.0.crx');
assert.equal(bytes.subarray(0, 4).toString(), 'Cr24'); assert.equal(bytes.readUInt32LE(4), 3);
const headerLength = bytes.readUInt32LE(8);
assert.ok(headerLength < bytes.length - 12 && headerLength < 1024 * 1024);
function fields(bytes) {
  let offset = 0; const result = new Map();
  const varint = () => {
    let n = 0, shift = 0, byte;
    do { assert.ok(offset < bytes.length && shift < 35); byte = bytes[offset++]; n += (byte & 127) * 2 ** shift; shift += 7; } while (byte & 128);
    return n;
  };
  while (offset < bytes.length) {
    const tag = varint(); assert.equal(tag & 7, 2);
    const length = varint(); assert.ok(offset + length <= bytes.length);
    result.set(tag >>> 3, bytes.subarray(offset, offset + length)); offset += length;
  }
  return result;
}
const header = fields(bytes.subarray(12, 12 + headerLength));
const proof = fields(header.get(2) ?? header.get(3));
const publicKey = proof.get(1), signature = proof.get(2), signedHeader = header.get(10000);
assert.ok(publicKey && signature && signedHeader);
assert.deepEqual(fields(signedHeader).get(1), createHash('sha256').update(publicKey).digest().subarray(0, 16));
const size = Buffer.alloc(4); size.writeUInt32LE(signedHeader.length);
const payload = Buffer.concat([Buffer.from('CRX3 SignedData\0'), size, signedHeader, bytes.subarray(12 + headerLength)]);
const key = createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
assert.ok(verify('sha256', payload, key, signature) || verify('sha256', payload, { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_AUTO }, signature));
assert.equal(bytes.subarray(12 + headerLength, 16 + headerLength).toString('hex'), '504b0304');
console.log('CRX3 developer signature, public-key identity and embedded ZIP verified.');
