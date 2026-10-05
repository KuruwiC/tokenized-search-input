import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packedLicense, packedReadme } from './pack-files.mjs';
import { packageRoot } from './package-paths.mjs';

writeFileSync(resolve(packageRoot, 'README.md'), packedReadme());
writeFileSync(resolve(packageRoot, 'LICENSE'), packedLicense());
