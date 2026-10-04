# Filta 0.1.1 installation downloads

- [Desktop ZIP](https://github.com/smo82-dev/filta/raw/refs/heads/main/downloads/news-filter-0.1.1.zip): extract into a permanent folder, then use **Load unpacked** in `chrome://extensions` or `edge://extensions` with Developer mode enabled.
- [Android CRX](https://github.com/smo82-dev/filta/raw/refs/heads/main/downloads/news-filter-0.1.1.crx): import through Lemur Browser's local CRX extension control and enable the extension. This is not an APK. Android device compatibility is not yet verified.
- [Source ZIP](https://github.com/smo82-dev/filta/raw/refs/heads/main/downloads/news-filter-source-0.1.1.zip): project source, tests, documentation and a production `dist/` folder. Build with Node.js 22+, `npm ci`, then `npm run build`.
- [SHA256SUMS.txt](SHA256SUMS.txt): checksums for these three packages.

After installation, open **News Filter → Settings**, choose topics and select **Start filtering**. Open or refresh a BBC, Guardian or RNZ news listing in that same browser. No categories are selected automatically. See the [full README](../README.md) for filtering controls, privacy, limitations and tests.

Private CRX signing keys are deliberately excluded. Keep the supplied key privately if you plan to build compatible updates.

Version 0.1.1 adds **Sponsored & Paid Content** and phrase matching against detected story labels/badges. Earlier 0.1.0 packages are retained for reference. Reload an updated unpacked extension and refresh news tabs; select the new category explicitly.
