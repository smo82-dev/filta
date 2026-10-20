# Token-Efficient AI Development

## Purpose
Reduce unnecessary input, output, reasoning and tool costs while preserving correctness, security, traceability and adequate testing. These instructions apply to Codex and other coding agents. They do not assert that GitHub content itself is an API prompt cache.

## Prompt caching facts
- Prompt/input caching is handled by the model provider automatically where supported. Cached input pricing may be lower; output and reasoning tokens do not receive a cached-output discount.
- Cache reuse is temporary and conditional on compatible repeated input; do not promise a particular cache-hit rate, duration or credit saving.
- Stable instructions and reused session context may improve cache opportunities. Repository files are durable records, not a substitute for provider-side caching.
- Never pad prompts or create wasteful repeated requests just to attempt a cache hit.

## Start or resume a task
1. Establish repository, active branch, existing pull request, task scope and current state. Continue the existing PR/branch unless instructed otherwise; never merge or deploy without permission.
2. Read `AGENTS.md`, then retrieve only the relevant sections of project context, roadmap, design standards and recent work. Inspect broader files when architectural or security impact warrants it.
3. Identify what is already implemented, tested, approved or blocked. Don't reinvent finished work.
4. State a concise plan for complex work, including affected components, validation and risks.

## Input efficiency
- Prefer targeted file search, diffs and bounded file reads over dumping the whole repository or long logs.
- Keep stable policies and architectural constraints in tracked Markdown; avoid duplicating large, slightly different instructions in prompts.
- Reuse the current compatible session when practical, but start fresh if context is degraded, incorrect or overwhelming. A new session should read the concise handover.
- Do not assume changing models, effort settings or tool interfaces will preserve any particular cache.
- Never pass secrets, credentials, customer data or large generated files to the model unnecessarily.

## Output and reasoning efficiency
- Implement focused diffs rather than rewriting intact files; refer to existing source and tests.
- Record approved design choices once; do not repeatedly re-argue settled decisions without new evidence.
- Prefer short, actionable progress reports and concise failures, not repeated full-file or full-log output.
- Use proportionate reasoning effort for routine changes, escalating for architecture, security, finance, data migration, concurrency and difficult debugging.
- Make safe, relevant batches of changes to avoid repetitive tool loops; stop and diagnose when tests repeatedly fail rather than blindly retrying.
- Never sacrifice code quality, accessibility, operational resilience, coverage or review standards to minimise tokens.

## Durable handover and continuity
For substantial work, update an existing task record or `docs/ai-development-handover.md` with:
- objective, branch/PR and base commit when relevant;
- completed work and key design decisions (with links to code/commits);
- files/modules changed and relevant tests with results;
- known defects, blockers and clear next actions;
- deployment/merge status and permissions;
- observed token/credit usage only if genuinely supplied by the tooling; otherwise say "not available".
Keep handovers brief and current. Do not store chain-of-thought, secrets or large transcripts. Source code and tests remain authoritative.

## Verification and reporting
- Run targeted tests first when appropriate, then the broader suite required by change risk, CI or project policy.
- Report what actually ran and what could not be verified; never invent green tests, cache hit counts, token totals, credit costs or elapsed time.
- If usage telemetry includes input, cached input, output and reasoning, report it separately. Distinguish estimates from measured values.
- Prefer a concise completion report: change summary, tests, risks, PR link, next action.

## Project-specific safeguards
- DeliverEasy: financial integrity, ledgers, payout controls, data migrations, dispatch and authentication always outrank token saving; follow project context and roadmap.
- VillageConnect: preserve deployed Replit/router integration, hotspot scripts, voucher/accounting behaviour and uptime; do not publish or alter live router settings without owner approval.
- Flipper and UsageFlipper: preserve pairing security, browser/desktop compatibility, correct usage collection and installer/onboarding states.
- FILTA: preserve local-first privacy, site compatibility, article detection and existing branding.
