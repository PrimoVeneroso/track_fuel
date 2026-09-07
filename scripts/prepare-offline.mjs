import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

async function files(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map(entry => entry.isDirectory()
    ? files(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}
const assets = (await files('out/_next/static'))
  .filter(path => /\.(js|css|woff2?|ttf)$/.test(path))
  .map(path => '/' + path.slice('out/'.length)).sort();
const source = await readFile('public/sw.js', 'utf8');
const html = await readFile('out/index.html', 'utf8');
const version = createHash('sha256').update(source).update(html).update(JSON.stringify(assets)).digest('hex').slice(0, 16);
const worker = source.replace('const CACHE = "fuellog-v2";', `const CACHE = "fuellog-${version}";`)
  .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(assets)};`);
await writeFile('out/sw.js', worker);
console.log(`Offline: ${assets.length} asset locali inclusi nella cache.`);
