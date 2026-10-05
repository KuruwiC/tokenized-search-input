// The locations and the required artifacts of the package, resolved from this file so that
// every script reads the same paths whatever directory it runs from.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repositoryRoot = resolve(packageRoot, '../..');
export const distRoot = resolve(packageRoot, 'dist');

// Relative to dist/, whether in the build output or in the packed tarball.
export const requiredDistArtifacts = [
  'index.js',
  'index.cjs',
  'index.d.ts',
  'index.d.cts',
  'utils.js',
  'utils.cjs',
  'utils.d.ts',
  'utils.d.cts',
  'index.css',
  'index.css.d.ts',
];
