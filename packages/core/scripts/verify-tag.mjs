import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const tag = process.env.GITHUB_REF_NAME ?? '';
const packageJson = JSON.parse(readFileSync(resolve('packages/core/package.json'), 'utf8'));
const expectedTag = `v${packageJson.version}`;

if (tag !== expectedTag) {
  console.error(`Release tag must be ${expectedTag}; received ${tag || '(missing)'}.`);
  process.exit(1);
}

console.log(`Verified release tag ${tag} matches package version ${packageJson.version}.`);
