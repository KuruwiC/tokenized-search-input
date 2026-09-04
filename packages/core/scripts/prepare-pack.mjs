import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');

for (const filename of ['README.md', 'LICENSE']) {
  copyFileSync(resolve(repositoryRoot, filename), resolve(packageRoot, filename));
}
