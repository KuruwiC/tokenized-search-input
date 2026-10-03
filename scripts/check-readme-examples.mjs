// Type-checks the TypeScript examples of README.md against the built package, and checks
// that README.md lists every runtime export of the /utils entry.
//
// Every ts or tsx fence of README.md must be preceded by one of:
//   <!-- example -->               compiled with `tsc --strict` against packages/core/dist
//   <!-- not-example: <reason> --> skipped, with the reason it cannot be compiled
//
// Run `pnpm build` first: the package is resolved by its real name, through its
// `exports` map, to the types in packages/core/dist.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = resolve(repositoryRoot, 'packages/core');
const readmePath = resolve(repositoryRoot, 'README.md');
const packageName = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8')).name;

const EXAMPLE_MARKER = /^<!--\s*example\s*-->$/;
const NOT_EXAMPLE_MARKER = /^<!--\s*not-example:\s*(\S.*?)\s*-->$/;
const FENCE_OPEN = /^```(ts|tsx|typescript)\s*$/;
const FENCE_CLOSE = /^```\s*$/;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function collectExamples(readme) {
  const lines = readme.split('\n');
  const examples = [];
  const problems = [];
  let inOtherFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const opening = FENCE_OPEN.exec(line);

    if (inOtherFence) {
      if (FENCE_CLOSE.test(line)) inOtherFence = false;
      continue;
    }
    if (!opening) {
      if (line.startsWith('```')) inOtherFence = true;
      continue;
    }

    let markerIndex = index - 1;
    while (markerIndex >= 0 && lines[markerIndex].trim() === '') markerIndex -= 1;
    const marker = markerIndex >= 0 ? lines[markerIndex].trim() : '';

    let end = index + 1;
    while (end < lines.length && !FENCE_CLOSE.test(lines[end])) end += 1;
    if (end === lines.length) {
      problems.push(`README.md:${index + 1}: the ${opening[1]} fence is never closed`);
      break;
    }

    if (EXAMPLE_MARKER.test(marker)) {
      examples.push({
        fenceLine: index + 1,
        extension: opening[1] === 'tsx' ? 'tsx' : 'ts',
        code: lines.slice(index + 1, end).join('\n'),
      });
    } else if (!NOT_EXAMPLE_MARKER.test(marker)) {
      problems.push(
        `README.md:${index + 1}: a ${opening[1]} fence needs <!-- example --> or <!-- not-example: reason --> on the line before it`
      );
    }
    index = end;
  }
  return { examples, problems };
}

function linkDependencies(projectDirectory) {
  const nodeModules = join(projectDirectory, 'node_modules');
  const links = [
    [join(nodeModules, ...packageName.split('/')), packageRoot],
    ...['react', 'react-dom', '@types/react', '@types/react-dom'].map((name) => [
      join(nodeModules, ...name.split('/')),
      realpathSync(join(packageRoot, 'node_modules', ...name.split('/'))),
    ]),
  ];
  for (const [link, target] of links) {
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(target, link, 'dir');
  }
}

function compileExamples(examples) {
  const projectDirectory = mkdtempSync(join(tmpdir(), 'tsi-readme-examples-'));
  try {
    linkDependencies(projectDirectory);
    mkdirSync(join(projectDirectory, 'examples'));
    examples.forEach((example, index) => {
      const name = `example-${String(index + 1).padStart(2, '0')}`;
      example.file = `examples/${name}.${example.extension}`;
      writeFileSync(join(projectDirectory, example.file), `${example.code}\n`);
    });
    writeFileSync(
      join(projectDirectory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'esnext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          noEmit: true,
          skipLibCheck: true,
          types: [],
          noUncheckedSideEffectImports: true,
        },
        include: ['examples'],
      })
    );

    const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
    const result = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.json', '--pretty', 'false'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    if (result.status === 0) return [];

    const byFile = new Map(examples.map((example) => [example.file, example]));
    return `${result.stdout}${result.stderr}`
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) =>
        line.replace(
          /^(examples\/example-\d+\.tsx?)\((\d+),(\d+)\)/,
          (match, file, row, column) => {
            const example = byFile.get(file);
            return example ? `README.md:${example.fenceLine + Number(row)}:${column}` : match;
          }
        )
      );
  } finally {
    rmSync(projectDirectory, { recursive: true, force: true });
  }
}

async function findUnlistedUtilsExports(readme) {
  const utils = await import(pathToFileURL(resolve(packageRoot, 'dist/utils.js')).href);
  return Object.keys(utils).filter((name) => !readme.includes(`\`${name}\``));
}

if (!existsSync(resolve(packageRoot, 'dist/index.d.ts'))) {
  fail('packages/core/dist is missing. Run `pnpm build` before `pnpm docs:check`.');
}

const readme = readFileSync(readmePath, 'utf8');
const { examples, problems } = collectExamples(readme);
if (examples.length === 0) problems.push('README.md has no <!-- example --> fences to compile.');
if (problems.length > 0) fail(problems.join('\n'));

const diagnostics = compileExamples(examples);
if (diagnostics.length > 0) {
  fail(`README examples do not compile:\n${diagnostics.join('\n')}`);
}

const unlisted = await findUnlistedUtilsExports(readme);
if (unlisted.length > 0) {
  fail(`README.md does not list these exports of ${packageName}/utils: ${unlisted.join(', ')}`);
}

console.log(`Compiled ${examples.length} README examples and found every /utils export listed.`);
