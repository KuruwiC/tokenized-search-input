import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRoot, packedLicense, packedReadme } from './pack-files.mjs';

const generated = [
  ['README.md', Buffer.from(packedReadme())],
  ['LICENSE', packedLicense()],
];

for (const [filename, content] of generated) {
  const generatedPath = resolve(packageRoot, filename);
  if (existsSync(generatedPath) && readFileSync(generatedPath).equals(content)) {
    unlinkSync(generatedPath);
  }
}
