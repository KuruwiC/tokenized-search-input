import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageRoot, packedLicense, packedReadme } from './pack-files.mjs';

writeFileSync(resolve(packageRoot, 'README.md'), packedReadme());
writeFileSync(resolve(packageRoot, 'LICENSE'), packedLicense());
