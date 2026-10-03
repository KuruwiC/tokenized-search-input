import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repositoryRoot = resolve(packageRoot, '../..');

const { name, version } = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
const archiveName = `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;

// The tarball that a GitHub release of the package publishes, as the README links to it.
const INSTALL_URL = /releases\/download\/v[^/\s"]+\/[^/\s"]+\.tgz/g;

// Stamps the install URLs so the README inside a tarball names its own release.
export function packedReadme() {
  const readme = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8');
  if (!readme.match(INSTALL_URL)) {
    throw new Error('README.md has no release tarball install URL to stamp with the version.');
  }
  return readme.replace(INSTALL_URL, `releases/download/v${version}/${archiveName}`);
}

export function packedLicense() {
  return readFileSync(resolve(repositoryRoot, 'LICENSE'));
}
