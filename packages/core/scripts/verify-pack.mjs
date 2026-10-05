import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const packageDirectory = resolve('dist-packages');
const archives = existsSync(packageDirectory)
  ? readdirSync(packageDirectory).filter((name) => name.endsWith('.tgz'))
  : [];

if (archives.length !== 1) {
  console.error(`Expected exactly one package archive, found ${archives.length}.`);
  process.exit(1);
}

const archive = resolve(packageDirectory, archives[0]);
const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split('\n');
for (const required of [
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  'package/dist/index.js',
  'package/dist/index.cjs',
  'package/dist/index.d.ts',
  'package/dist/index.d.cts',
  'package/dist/utils.js',
  'package/dist/utils.cjs',
  'package/dist/utils.d.ts',
  'package/dist/utils.d.cts',
  'package/dist/index.css',
  'package/dist/index.css.d.ts',
]) {
  if (!entries.includes(required)) {
    console.error(`Packed artifact is missing ${required}.`);
    process.exit(1);
  }
}

// Every install URL in the packed README names this release's own tarball.
const read = (entry) => execFileSync('tar', ['-xzOf', archive, entry], { encoding: 'utf8' });
const { version } = JSON.parse(read('package/package.json'));
const expectedUrl = `releases/download/v${version}/${archives[0]}`;
const installUrls = read('package/README.md').match(/releases\/download\/[^\s"]+/g) ?? [];
if (installUrls.length === 0 || installUrls.some((url) => url !== expectedUrl)) {
  console.error(`The packed README links to a release other than v${version}.`);
  process.exit(1);
}

console.log(`Verified packed artifact ${archives[0]}.`);
