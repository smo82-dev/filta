# Publisher compatibility — FILTA 0.2.0

Checked 21 October 2026, Vanuatu time (20 October UTC). All access was through ordinary public requests in a fresh unsigned browser. No paywall or sign-in bypass was attempted.

A non-zero count demonstrates discovery only. It does **not** measure all articles on that page, prove category accuracy, or establish native extension compatibility. Live flow checks used the production scanner/renderer with an in-memory platform adapter; they are separate from simulated publisher fixtures and native MV3 installation.

| Region | Publisher | Saved HTTP response cards | Rendered/browser evidence | Saved snippets |
| --- | --- | ---: | --- | --- |
| US | Yahoo News | 33 | 63 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| US | CNN | 48 | Zero cards / shell; unverified | 3 saved source snippets |
| US | Fox News | 194 | 195 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| US | New York Times | 0 | Zero cards / shell; unverified | None; not claimed |
| US | NBC | 96 | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | 3 saved source snippets |
| US | CBS | 53 | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | 3 saved source snippets |
| US | ABC News | 142 | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | 3 saved source snippets |
| US | USA Today | — | Blocked or timed out; Access response 402; stopped | None; not claimed |
| US | AP News | 141 | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | 3 saved source snippets |
| US | Reuters | — | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | None; not claimed |
| US | Washington Post | 104 | 104 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| US | MSN | 0 | Zero cards / shell; unverified | None; not claimed |
| UK | BBC | 49 | 49 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| UK | The Guardian | 150 | 149 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| UK | Sky News | 134 | 131 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| UK | Daily Mail | — | Blocked or timed out; Access response 403; stopped | None; not claimed |
| UK | Telegraph | — | Blocked or timed out; Access response 402; stopped | None; not claimed |
| UK | Independent | 109 | 109 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| UK | The Times | 0 | Blocked or timed out; page.addScriptTag: Target page, context or browser has been closed | None; not claimed |
| UK | Mirror | 0 | Blocked or timed out; page.content: Target page, context or browser has been closed | None; not claimed |
| UK | The Sun | 132 | Blocked or timed out; page.addScriptTag: Target page, context or browser has been closed | 3 saved source snippets |
| UK | Financial Times | — | Blocked or timed out; Access response 403; stopped | None; not claimed |
| AU | ABC Australia | 62 | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | 3 saved source snippets |
| AU | news.com.au | — | HTTP Error 403: Forbidden | None; not claimed |
| AU | 9News | 74 | 74 discovered; Hide/Collapse/Pause; 0 render mismatches; redirected to nine.com.au | 3 saved source snippets |
| AU | Sydney Morning Herald | 0 | Zero cards / shell; unverified | None; not claimed |
| AU | The Age | 0 | Zero cards / shell; unverified | None; not claimed |
| AU | SBS | 63 | 56 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| AU | 7NEWS | 28 | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | 3 saved source snippets |
| AU | The Australian | — | Blocked or timed out; Access response 403; stopped | None; not claimed |
| NZ | RNZ | 135 | 133 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| NZ | Stuff | 0 | Rendered loading placeholders, no article links; original mixed-filtering report not reproduced | None; not claimed |
| NZ | NZ Herald | 82 | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | 3 saved source snippets |
| NZ | 1News | 243 | 161 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| NZ | Otago Daily Times | 33 | 33 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| NZ | The Press | 0 | 80 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| NZ | The Post | 0 | 127 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |
| NZ | Newsroom | 66 | Blocked or timed out; page.goto: Timeout 20000ms exceeded. | 3 saved source snippets |
| NZ | The Spinoff | 83 | 83 discovered; Hide/Collapse/Pause; 0 render mismatches | 3 saved source snippets |

Saved snippets preserve actual captured card markup, with scripts/styles/resource variants removed and neutral repeated wrappers used to retain isolated-card context. They are not full saved pages. The sample was selected from discoverable cards and cannot independently measure whole-page recall. The controlled 61-card structural fixture provides that separately.

NYT, Mirror, SMH and The Age returned a short “Site Unavailable” response despite HTTP 200. The Times returned a consent/access response. MSN remained a shell. USA Today and Telegraph returned 402, Reuters 401, Daily Mail/Financial Times/news.com.au/The Australian 403 in the HTTP attempts. Some browser attempts timed out even when a static response was available. No blocked publisher is marked compatible.

Stuff remains a release acceptance gap. The Press and The Post rendered usable cards in separate browser attempts; this does not prove the current Stuff homepage behaves identically.

See `compatibility.json` for URLs, redirect destinations, timestamps, HTTP results and individual topic/renderer counts. Raw full publisher pages, user browsing data and screenshots are not shipped.
