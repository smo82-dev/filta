import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dirname, '..'));
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({
  entryPoints: { content: 'src/content/index.ts', background: 'src/platform/background.ts',
    popup: 'src/ui/popup.ts', settings: 'src/ui/settings.ts' },
  bundle: true, outdir: 'dist', format: 'iife', platform: 'browser', target: 'chrome110',
  minify: true, legalComments: 'none', sourcemap: false,
});
console.log('Built dist/: self-contained Manifest V3 extension.');
