/**
 * Zips dist/ for upload through cPanel's File Manager, as jsonspace-<commit>.zip in
 * the project root.
 *
 * cPanel's extractor applies the Unix permissions stored in the zip. Windows
 * zip tools store 666 for files and 777 for folders, which left the live site
 * world-writable after every extract. This writes the archive by hand so each
 * entry records 644 (files) or 755 (folders), and extracting needs no
 * permission fix afterwards.
 */
import { execSync } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');

const FILE_MODE = 0o100644;
const DIR_MODE = 0o040755;
// "Version made by": high byte 3 = Unix, so extractors read the mode bits
// from the external attributes. Low byte 20 = ZIP spec 2.0.
const MADE_BY_UNIX = (3 << 8) | 20;
const NEEDED = 20;

/** Folders (with trailing slash) and files under dir, parents first. */
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const name = relative(distDir, full).split(sep).join('/');
    if (entry.isDirectory()) out.push({ name: `${name}/` }, ...(await walk(full)));
    else out.push({ name, full });
  }
  return out;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

try {
  await stat(join(distDir, 'index.html'));
} catch {
  console.error('dist/index.html is missing. Run `bun run build` first.');
  process.exit(1);
}

const commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
const dirty = execSync('git status --porcelain', { cwd: root }).toString().trim() !== '';
const outName = `jsonspace-${commit}.zip`;

const { time, day } = dosDateTime(new Date());
const locals = [];
const centrals = [];
let offset = 0;

for (const entry of await walk(distDir)) {
  const isDir = entry.name.endsWith('/');
  const name = Buffer.from(entry.name, 'utf8');
  const raw = isDir ? Buffer.alloc(0) : await readFile(entry.full);
  const packed = isDir ? raw : deflateRawSync(raw, { level: 9 });
  const method = isDir ? 0 : 8;
  const crc = isDir ? 0 : crc32(raw);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(NEEDED, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 names
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, name, packed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(MADE_BY_UNIX, 4);
  central.writeUInt16LE(NEEDED, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30); // extra
  central.writeUInt16LE(0, 32); // comment
  central.writeUInt16LE(0, 34); // disk
  central.writeUInt16LE(0, 36); // internal attrs
  // Unix mode in the high 16 bits; 0x10 is the MS-DOS directory flag.
  central.writeUInt32LE((((isDir ? DIR_MODE : FILE_MODE) << 16) | (isDir ? 0x10 : 0)) >>> 0, 38);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += local.length + name.length + packed.length;
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const count = centrals.length / 2;
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(count, 8);
end.writeUInt16LE(count, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);

await writeFile(join(root, outName), Buffer.concat([...locals, ...centrals, end]));
console.log(`wrote ${outName} (${count} entries, files 644, folders 755)`);
if (dirty) console.log(`note: includes uncommitted changes, so it is not exactly ${commit}.`);
