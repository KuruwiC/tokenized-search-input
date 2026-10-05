// Checks the contents of a packed tarball: the required files, and that the README names
// this release's own tarball in every install URL.
//
// Usage: node packages/core/scripts/verify-pack.mjs path/to/package.tgz

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { requiredDistArtifacts } from './package-paths.mjs';

if (!process.argv[2]) {
  console.error('Usage: node verify-pack.mjs path/to/package.tgz');
  process.exit(1);
}
const archive = resolve(process.argv[2]);
if (!existsSync(archive)) {
  console.error(`Tarball not found: ${archive}`);
  process.exit(1);
}

const entries = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).split('\n');
for (const required of [
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  ...requiredDistArtifacts.map((path) => `package/dist/${path}`),
]) {
  if (!entries.includes(required)) {
    console.error(`Packed artifact is missing ${required}.`);
    process.exit(1);
  }
}

// Every install URL in the packed README names this release's own tarball.
const read = (entry) => execFileSync('tar', ['-xzOf', archive, entry], { encoding: 'utf8' });
const { version } = JSON.parse(read('package/package.json'));
const expectedUrl = `releases/download/v${version}/${basename(archive)}`;
const installUrls = read('package/README.md').match(/releases\/download\/[^\s"]+/g) ?? [];
if (installUrls.length === 0 || installUrls.some((url) => url !== expectedUrl)) {
  console.error(`The packed README links to a release other than v${version}.`);
  process.exit(1);
}

console.log(`Verified packed artifact ${basename(archive)}.`);
