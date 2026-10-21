# Original FILTA artwork

These six PNGs are unchanged copies of the owner-supplied files already committed at the repository root in `a1c9246`. The 128 px store source and 1254 px master remain authentic source assets. Supplied 16/32/48/128 px icons are copied into `public/icons/`; the store icon is also copied as `logo.png` for the UI. No redraw, recolouring, cropping, vectorisation or new resampling was necessary.

`npm run audit:package` checks source/copy byte equality, PNG dimensions and manifest/action references. `SHA256SUMS` records the source files. Store signing inputs are separate and remain excluded. An unpacked test installation can have a different extension ID; no replacement store listing or manifest signing key is introduced.
