// Bundles the declarations of each package entry into one file, `dist/<entry>.d.ts`, and
// copies it to `dist/<entry>.d.cts` for the `require` conditions. A bundled file has no
// relative imports, so it reads the same under `bundler`, `node16` and `nodenext`
// resolution, from ESM and from CommonJS.

import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const entry of ['index', 'utils']) {
  const bundle = await rollup({
    input: resolve(packageRoot, `src/${entry}.ts`),
    plugins: [dts({ tsconfig: resolve(packageRoot, 'tsconfig.build.json') })],
  });
  const declarations = resolve(packageRoot, `dist/${entry}.d.ts`);
  await bundle.write({ file: declarations, format: 'es' });
  await bundle.close();
  copyFileSync(declarations, resolve(packageRoot, `dist/${entry}.d.cts`));
}
