// Installs the packed tarball into minimal scratch projects (React 18 and 19) and
// verifies what a real consumer sees: strict type resolution of the ESM entry
// points (bundler resolution), plain Node ESM/CJS imports, and the published dist.
//
// Usage: node scripts/verify-consumer.mjs [path/to/package.tgz]
// Without an argument the package is packed into the scratch directory first.

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const packageName = '@kuruwic/tokenized-search-input';

const reactMatrix = [
  { react: '18.3.1', types: '18' },
  { react: '19.1.1', types: '19' },
];

const rootManifest = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'));
const typescriptSpec = rootManifest.devDependencies.typescript;

const esmCheckSource = `import {
  type FieldDefinition,
  type QuerySnapshot,
  TokenizedSearchInput,
  type TokenizedSearchInputRef,
  useAsyncTokenResolver,
} from '${packageName}';
import { type DateTimeValue, parseDateTimeValue } from '${packageName}/utils';
import '${packageName}/styles';
import { useRef } from 'react';

const readDate = (input: string): DateTimeValue | null => {
  const parsed = parseDateTimeValue(input, 'date');
  return parsed.ok ? parsed.value : null;
};

const fields: FieldDefinition[] = [
  { key: 'status', label: 'Status', type: 'enum', operators: ['is'], enumValues: ['open', 'closed'] },
  { key: 'due', label: 'Due', type: 'date', operators: ['gt'], formatConfig: { parse: readDate } },
];

export function Search({ onSearch }: { onSearch: (snapshot: QuerySnapshot) => void }) {
  const ref = useRef<TokenizedSearchInputRef>(null);
  const { resolveTokens } = useAsyncTokenResolver({
    inputRef: ref,
    fieldKey: 'status',
    resolve: async (values) => values.map((value) => ({ value, label: value.toUpperCase() })),
    getValue: (item) => item.value,
    getDisplayData: (item) => ({ displayValue: item.label }),
  });
  return (
    <TokenizedSearchInput
      ref={ref}
      fields={fields}
      unknownFields={{ operators: ['is', 'contains'] }}
      onChange={() => void resolveTokens()}
      onSubmit={onSearch}
    />
  );
}
`;

const esmRuntimeScript = `
import { TokenizedSearchInput } from '${packageName}';
import { parseDateTimeValue } from '${packageName}/utils';
if (!TokenizedSearchInput) throw new Error('TokenizedSearchInput export is missing');
if (!parseDateTimeValue('2024-01-31', 'date').ok) throw new Error('parseDateTimeValue rejected a valid date');
`;

const cjsRuntimeScript = `
const { TokenizedSearchInput } = require('${packageName}');
const { parseDateTimeValue } = require('${packageName}/utils');
if (!TokenizedSearchInput) throw new Error('TokenizedSearchInput export is missing');
if (!parseDateTimeValue('2024-01-31', 'date').ok) throw new Error('parseDateTimeValue rejected a valid date');
`;

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: 'inherit', ...options });
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function resolveTarball(scratchRoot) {
  if (process.argv[2]) {
    const tarball = resolve(process.argv[2]);
    if (!existsSync(tarball)) throw new Error(`Tarball not found: ${tarball}`);
    return tarball;
  }
  const destination = join(scratchRoot, 'pack');
  mkdirSync(destination);
  run('pnpm', ['pack', '--pack-destination', destination], { cwd: packageRoot });
  const archives = readdirSync(destination).filter((name) => name.endsWith('.tgz'));
  if (archives.length !== 1) {
    throw new Error(`Expected exactly one package archive, found ${archives.length}.`);
  }
  return join(destination, archives[0]);
}

function verifyArchive(tarball) {
  const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const maps = entries.filter((entry) => entry.endsWith('.map'));
  if (maps.length > 0) {
    throw new Error(`Packed artifact contains source or declaration maps:\n- ${maps.join('\n- ')}`);
  }
}

function exportTargets(value) {
  if (typeof value === 'string') return [value];
  return Object.values(value).flatMap(exportTargets);
}

function verifyInstalledPackage(projectDirectory) {
  const installed = join(projectDirectory, 'node_modules', packageName);
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  const outsideDist = exportTargets(manifest.exports).filter(
    (target) => !target.startsWith('./dist/')
  );
  if (outsideDist.length > 0) {
    throw new Error(`package.json exports point outside dist: ${outsideDist.join(', ')}`);
  }

  // Unbundled ESM consumers have no process global, so every NODE_ENV read must be guarded.
  const unguarded = [];
  for (const file of listFiles(join(installed, 'dist'))) {
    if (!/\.c?js$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/process\.env/g)) {
      const preceding = source.slice(Math.max(0, match.index - 80), match.index);
      if (!/typeof process\s*(!==|!=|<)\s*(['"]undefined['"]|["']u["'])/.test(preceding)) {
        unguarded.push(relative(installed, file));
      }
    }
  }
  if (unguarded.length > 0) {
    throw new Error(`Unguarded process.env reads in dist:\n- ${unguarded.join('\n- ')}`);
  }
}

function verifyWithReact(scratchRoot, tarball, { react, types }) {
  const label = `react ${react}`;
  console.log(`\n--- consumer check: ${label} ---`);
  const projectDirectory = join(scratchRoot, `react-${types}`);
  mkdirSync(projectDirectory);

  writeFileSync(
    join(projectDirectory, 'package.json'),
    `${JSON.stringify(
      {
        name: `consumer-react-${types}`,
        private: true,
        type: 'module',
        dependencies: {
          [packageName]: `file:${tarball}`,
          react,
          'react-dom': react,
        },
        devDependencies: {
          '@types/react': `^${types}`,
          '@types/react-dom': `^${types}`,
          typescript: typescriptSpec,
        },
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(projectDirectory, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'esnext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          noEmit: true,
          skipLibCheck: false,
          types: [],
          noUncheckedSideEffectImports: true,
        },
        include: ['check.tsx'],
      },
      null,
      2
    )}\n`
  );
  writeFileSync(join(projectDirectory, 'check.tsx'), esmCheckSource);

  run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile', '--prefer-offline'], {
    cwd: projectDirectory,
  });
  verifyInstalledPackage(projectDirectory);
  run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.json'], { cwd: projectDirectory });
  run('node', ['--input-type=module', '-e', esmRuntimeScript], { cwd: projectDirectory });
  run('node', ['--input-type=commonjs', '-e', cjsRuntimeScript], { cwd: projectDirectory });
  console.log(`Verified consumer project (${label}).`);
}

const scratchRoot = mkdtempSync(join(tmpdir(), 'tsi-consumer-'));
let succeeded = false;
try {
  const tarball = resolveTarball(scratchRoot);
  verifyArchive(tarball);
  for (const entry of reactMatrix) verifyWithReact(scratchRoot, tarball, entry);
  succeeded = true;
  console.log('\nVerified consumer installs for React 18 and 19.');
} catch (error) {
  console.error(
    `\nConsumer verification failed: ${error instanceof Error ? error.message : error}`
  );
  console.error(`Scratch directory kept for inspection: ${scratchRoot}`);
  process.exitCode = 1;
} finally {
  if (succeeded) rmSync(scratchRoot, { recursive: true, force: true });
}
