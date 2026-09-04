import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');

for (const filename of ['README.md', 'LICENSE']) {
  const generatedPath = resolve(packageRoot, filename);
  const sourcePath = resolve(repositoryRoot, filename);
  if (existsSync(generatedPath) && readFileSync(generatedPath).equals(readFileSync(sourcePath))) {
    unlinkSync(generatedPath);
  }
}
