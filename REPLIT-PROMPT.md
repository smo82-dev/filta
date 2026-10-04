# Replit development prompt for Filta

Use this prompt when importing https://github.com/smo82-dev/filta into Replit:

> Work in the existing `smo82-dev/filta` repository. Inspect `README.md`, `package.json`, `VALIDATION.md`, and the source before changing anything. This is a TypeScript Manifest V3 browser extension, not a hosted website. Keep its local-first operation, browser-independent `src/core` engine, thin `src/platform` adapter, conservative DOM detection, and touch-friendly controls. Shared card labels are extracted in `src/content/detectors/labels.ts`; preserve their ownership checks, the Sponsored & Paid Content category, and always-show precedence. Do not add a backend, account, telemetry, cloud AI, or external runtime resources.
>
> Install the pinned dependencies with `npm ci` using Node.js 22 or newer. Run `npm test`, `npm run build`, and `npm run audit:package`. Install Playwright Chromium before running `npm run test:browser`; distinguish its simulated WebExtension APIs from the separate native `npm run test:extension` smoke test. Do not claim device tests that were not performed.
>
> Implement the requested change within the existing architecture and add appropriate tests. Update the README and validation notes. Use `npm run package` for the desktop ZIP. Android CRX updates require a full Chrome/Chromium executable and the existing private signing key, supplied separately; never commit a PEM file or regenerate the published CRX with a different identity accidentally. Update the downloadable files and SHA-256 checksums when releasing a new version. Do not publish a web app as a substitute for the extension.
>
> Requested change: [describe the change here].
