import { readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = resolve(packageRoot, 'dist');

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [relative(distRoot, path)];
  });
}

const leakedTestArtifacts = listFiles(distRoot).filter(
  (path) =>
    path.startsWith('__tests__/') || path.includes('/__tests__/') || path.endsWith('.test.d.ts')
);

if (leakedTestArtifacts.length > 0) {
  console.error('Test declarations leaked into dist:');
  for (const path of leakedTestArtifacts) console.error(`- ${path}`);
  process.exitCode = 1;
} else {
  console.log('Verified dist: no test declarations.');
}
