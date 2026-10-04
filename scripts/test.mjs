import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dirname, '..'));
await mkdir('tests/.generated', { recursive: true });
await build({ stdin: { contents: [
  "export * from './src/core/classifier';", "export * from './src/core/filter-engine';",
  "export * from './src/core/preferences';", "export * from './src/core/text';",
  "export * from './src/core/rules/categories';",
].join('\n'), resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, outfile: 'tests/.generated/core.mjs', platform: 'node', format: 'esm', target: 'node22' });
await build({ stdin: { contents: "export * from './src/content/detectors/generic'; export * from './src/content/detectors/sites'; export * from './src/content/page-eligibility';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, outfile: 'tests/.generated/detectors.js', platform: 'browser', format: 'iife', globalName: 'NFDetectors' });
await build({ stdin: { contents: "export * from './src/content/page-scanner';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, outfile: 'tests/.generated/scanner.js', platform: 'browser', format: 'iife', globalName: 'NFScanner' });
const result = spawnSync(process.execPath, ['--test', 'tests/core.test.mjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
