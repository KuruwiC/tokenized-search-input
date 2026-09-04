import { existsSync, readdirSync } from 'node:fs';
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

const requiredEntryArtifacts = [
  'index.js',
  'index.cjs',
  'index.d.ts',
  'index.d.cts',
  'utils.js',
  'utils.cjs',
  'utils.d.ts',
  'utils.d.cts',
  'internal.js',
  'internal.cjs',
  'internal.d.ts',
  'internal.d.cts',
  'index.css',
  'index.css.d.ts',
];
const missingEntryArtifacts = requiredEntryArtifacts.filter(
  (path) => !existsSync(resolve(distRoot, path))
);

if (leakedTestArtifacts.length > 0 || missingEntryArtifacts.length > 0) {
  if (missingEntryArtifacts.length > 0) {
    console.error('Required package artifacts are missing:');
    for (const path of missingEntryArtifacts) console.error(`- ${path}`);
  }
  console.error('Test declarations leaked into dist:');
  for (const path of leakedTestArtifacts) console.error(`- ${path}`);
  process.exitCode = 1;
} else {
  console.log('Verified dist: package entries are present and no test declarations leaked.');
}
