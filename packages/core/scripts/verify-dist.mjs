import { existsSync, readdirSync, statSync } from 'node:fs';
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

const javascriptArtifacts = listFiles(distRoot).filter(
  (path) => path.endsWith('.js') || path.endsWith('.cjs')
);
// Keep this comfortably above the correctly externalized build while catching
// accidental rebundling of runtime dependencies (which is several times larger).
const maxJavascriptArtifactBytes = 200_000;
const oversizedJavascriptArtifacts = javascriptArtifacts.filter(
  (path) => statSync(resolve(distRoot, path)).size > maxJavascriptArtifactBytes
);

if (
  leakedTestArtifacts.length > 0 ||
  missingEntryArtifacts.length > 0 ||
  oversizedJavascriptArtifacts.length > 0
) {
  if (missingEntryArtifacts.length > 0) {
    console.error('Required package artifacts are missing:');
    for (const path of missingEntryArtifacts) console.error(`- ${path}`);
  }
  if (leakedTestArtifacts.length > 0) {
    console.error('Test declarations leaked into dist:');
    for (const path of leakedTestArtifacts) console.error(`- ${path}`);
  }
  if (oversizedJavascriptArtifacts.length > 0) {
    console.error(
      `JavaScript artifact budget exceeded (maximum ${maxJavascriptArtifactBytes} bytes):`
    );
    for (const path of oversizedJavascriptArtifacts) {
      console.error(`- ${path}: ${statSync(resolve(distRoot, path)).size} bytes`);
    }
    console.error('Runtime dependencies may have been bundled accidentally.');
  }
  process.exitCode = 1;
} else {
  const largestJavascriptArtifact = Math.max(
    ...javascriptArtifacts.map((path) => statSync(resolve(distRoot, path)).size)
  );
  console.log(
    `Verified dist: package entries are present, no test declarations leaked, and JavaScript artifacts are within budget (largest ${largestJavascriptArtifact}/${maxJavascriptArtifactBytes} bytes).`
  );
}
