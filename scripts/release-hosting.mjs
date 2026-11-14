import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const api = 'https://firebasehosting.googleapis.com/v1beta1/';
const site = 'sites/bbo-s-household-account';
const { hosting } = JSON.parse(await readFile('firebase.json', 'utf8'));
const token = process.env.HOSTING_TOKEN;
if (!token) throw new Error('Missing GitHub Actions identity');

async function request(url, method, body, binary = false) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': binary ? 'application/octet-stream' : 'application/json',
    },
    body: binary ? body : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(method + ' ' + new URL(url).pathname + ': ' + await response.text());
  if (!binary) return response.json();
}

const files = {};
const blobs = new Map();
async function collect(dir = '') {
  for (const entry of await readdir(hosting.public + dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['firebase.json', 'node_modules'].includes(entry.name)) continue;
    const path = dir + '/' + entry.name;
    if (entry.isDirectory()) await collect(path);
    if (!entry.isFile()) continue;
    const compressed = gzipSync(await readFile(hosting.public + path));
    const hash = createHash('sha256').update(compressed).digest('hex');
    files[path] = hash;
    blobs.set(hash, compressed);
  }
}
await collect();
const config = {
  headers: hosting.headers.map(({source, headers}) => ({
    glob: source, headers: Object.fromEntries(headers.map(({key,value}) => [key,value])),
  })),
  rewrites: hosting.rewrites.map(({source,destination}) => ({glob:source,path:destination})),
};
const version = await request(api + site + '/versions', 'POST', { config });
const manifest = await request(api + version.name + ':populateFiles', 'POST', { files });
for (const hash of manifest.uploadRequiredHashes ?? []) {
  await request(manifest.uploadUrl + '/' + hash, 'POST', blobs.get(hash), true);
}
await request(api + version.name + '?updateMask=status', 'PATCH', { status:'FINALIZED' });
const release = await request(api + site + '/releases?versionName=' + version.name, 'POST', { message:process.env.GITHUB_SHA });
console.log('Released', release.name, 'at', release.releaseTime);
