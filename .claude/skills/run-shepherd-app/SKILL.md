---
name: run-shepherd-app
description: Build, run, and drive shepherd-app (the SHEP.HERD Next.js church-management web app). Use when asked to start shepherd-app, run its dev server, build it, take a screenshot of its UI, or verify a change actually renders — not just typechecks.
---

Next.js 13 App Router web app. There is no `chromium-cli` binary in this
container, so it's driven by a small custom Playwright REPL at
`.claude/skills/run-shepherd-app/driver.cjs` — same command shape as
`chromium-cli` (`nav` / `wait-for` / `screenshot` / `click` / `fill` /
`console`), piped commands over stdin. All paths below are relative to
the repo root.

## Prerequisites

Nothing to install — Node 22, the Next.js toolchain, and a global
Playwright with Chromium pre-installed are already present in this
container (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). The one thing
to know: Playwright itself is only a **global** package
(`/opt/node22/lib/node_modules`), not a project dependency, so it needs
`NODE_PATH` set explicitly (see below) — and only via CommonJS
`require`, not ESM `import` (see Gotchas).

## Setup

No install step — `node_modules` is already present in this environment.
If it isn't (fresh clone): `npm install`.

**Env vars — none are real secrets required to boot the app or drive its
public pages.** The app needs *some* value for these or it throws at
startup; a placeholder is enough to build/run/screenshot anything that
doesn't call a live Supabase project:

```bash
export JWT_SECRET=dummy_jwt_secret_for_local_run_only_0000
export NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy
export SUPABASE_SERVICE_ROLE_KEY=dummy
```

**Real Supabase credentials, if you have them** (only needed to drive
anything behind login — dashboard, cell/fellowship/department/etc.
portals, any `/api/*` route): set the four vars above to the real
project URL/keys instead of the dummy values. This skill has not been
run against a real project — see Gotchas.

## Build

```bash
npm run build
```

Skip this for iterating on the dev server (`next dev` compiles routes
on demand instead). Run it before shipping any change — it's the same
command Vercel runs, and it catches things `next dev` won't.

## Run (agent path)

Start the dev server in the background, wait for it to actually serve,
then drive it:

```bash
JWT_SECRET=dummy_jwt_secret_for_local_run_only_0000 \
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy \
SUPABASE_SERVICE_ROLE_KEY=dummy \
nohup npm run dev > /tmp/shepherd-dev.log 2>&1 &
disown
timeout 30 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
```

Stop it with `lsof -ti:3000 -sTCP:LISTEN | xargs -r kill` before
relaunching (same reasoning as chromium-cli's own docs: `$!` is only the
npm wrapper's pid, npm doesn't forward SIGTERM to the `next` process it
spawns).

Drive it — pipe commands to the driver's stdin:

```bash
NODE_PATH=/opt/node22/lib/node_modules node .claude/skills/run-shepherd-app/driver.cjs <session-name> <<'EOF'
nav http://localhost:3000
wait-for selector=body
sleep 2000
screenshot landing
console
quit
EOF
```

Screenshots land in
`.claude/skills/run-shepherd-app/sessions/<session-name>/screenshots/`
(gitignored — throwaway, not committed). Logs from the running server:
`/tmp/shepherd-dev.log`.

| command | what it does |
|---|---|
| `nav <url>` | navigate |
| `wait-for text=<substring>` or `wait-for selector=<css>` | wait for an element |
| `sleep <ms>` | plain delay — needed before `console` to let async warnings/errors actually fire and be captured (see Gotchas) |
| `screenshot [name]` | full-page PNG |
| `click <css>` / `fill <css> <text>` / `press <key>` | interact |
| `eval <js-expr>` | run JS in the page, prints the JSON-serialized result |
| `console` | print buffered console/page errors since the last `console` call, **with resolved arg values** (see Gotchas — this is not `chromium-cli`'s plain `msg.text()`) |
| `quit` | close the browser and exit |

**What's actually reachable without real credentials:** the public
marketing site (`/`), `/login`, `/register`, `/docs`, and `/setup` — the
onboarding wizard, pure client-side state until final submission, so it
responds to real `fill`/`click`/`press` input with no backend at all.
Verified through its first few steps (church name -> country -> a
"Skip" button on optional questions) with a live-updating preview panel
on the right that reflects each answer immediately — real interaction,
not just a static render. Didn't drive it all the way to the
`structure_type` question (28 steps total, several with UI shapes —
branch-list add, multi-select — not yet scripted here); that's the next
useful thing to extend this driver with if you need to verify a
structure-labeling change end-to-end through onboarding specifically.
Anything behind login 401s on its data fetches with the dummy Supabase
URL (expected, not a bug) and won't render real content.

## Run (human path)

```bash
npm run dev   # -> http://localhost:3000, open in a browser. Ctrl-C to stop.
```

## Test

No test suite exists in this repo (`package.json` has only
`dev`/`build`/`start`/`lint` — confirmed by inspection, not assumed).
`npx tsc --noEmit -p .` is the closest thing to a safety net; expect 6
known pre-existing, unrelated errors (`api/ai/query`, `api/analytics/
giving`, `api/workforce/intelligence`, `api/workforce/rosters`,
`care/page.tsx`, `cell/page.tsx`) — anything beyond those 6 is a real
regression.

---

## Gotchas

- **This driver has no persistent session across separate invocations —
  unlike a real `chromium-cli` daemon, each `node driver.cjs <name>` is
  a fresh process that launches its own browser and starts at
  `about:blank`.** Running `nav` in one bash call, then `click` in a
  separate later bash call under the same session name, does **not**
  continue the same page — the second call's browser has nothing loaded
  yet, so `wait-for`/`click` just time out against a blank page. A
  multi-step flow (fill a form, click through several wizard screens,
  ...) has to be one heredoc, one invocation, start to finish.

- **`NODE_PATH` only works for `require`, not ESM `import`.** Playwright
  is a global package, not a project dependency. `node --input-type=
  module -e "import {chromium} from 'playwright'"` with `NODE_PATH` set
  throws `ERR_MODULE_NOT_FOUND` — Node's ESM resolver ignores
  `NODE_PATH` entirely. `require('playwright')` with the same
  `NODE_PATH` resolves fine. This is why the driver is `.cjs`, not
  `.mjs`.

- **A heredoc's stdin closes before your commands finish running.**
  `readline`'s `'close'` event fires the instant all piped lines have
  been read — which, with a `<<'EOF'` heredoc, is almost immediately,
  well before the async handlers for those lines (`nav`, `screenshot`,
  ...) have actually resolved. A driver that calls `browser.close()`
  straight from `'close'` will close the browser mid-navigation,
  producing `net::ERR_ABORTED` on whatever was in flight and "Target
  page ... has been closed" on every command after it. Fix: chain every
  `line` handler through one promise and `await` that chain before
  closing (already done in `driver.cjs` — see the comment above its
  `queue` variable if this needs touching again).

- **`msg.text()` alone doesn't fill in `%s` placeholders from multi-arg
  `console.error`/`warn` calls.** React's hydration-mismatch warning is
  exactly this shape: `Warning: Text content did not match. Server:
  "%s" Client: "%s"`. Playwright's `msg.text()` prints the *literal*
  `%s`, then dumps the remaining args' raw content after it — genuinely
  misleading, because it looks like the first line is the whole message
  and the info you need got cut off. Resolve each arg via
  `arg.jsonValue()` and print them alongside (already done in
  `driver.cjs`'s console listener).

- **Hydration warnings need real wall-clock time to fire.** Calling
  `console` immediately after `wait-for selector=body` can miss them —
  `body` exists the instant the HTML loads, well before React finishes
  hydrating and comparing. A `sleep 2000`–`3000` before `console` is
  what actually catches them reliably; a screenshot step (which itself
  takes real time to encode) had the same effect by accident during
  investigation.

- **`next dev`'s hydration warnings are dev-only and unminified; the
  same defect in a production build shows only as `Minified React error
  #418`/`#423`/`#425`.** Dev mode is where you *find* the actual mismatch
  (readable Server/Client text diff); a production `build`+`start` is
  where you *confirm* it's real and not a dev-mode-only artifact — the
  minified error codes decode at
  `https://reactjs.org/docs/error-decoder.html?invariant=<code>` but
  dev mode's plain-text warning is far faster to read directly.

- **`<style>{`...`}</style>` (a plain JSX text child) silently
  HTML-escapes the string on the way to markup — even though `<style>`
  is a "raw text" element per the HTML spec, so the browser never
  HTML-decodes anything inside it.** If that CSS string contains any of
  `' " < > &` (an apostrophe in a comment, a contraction, anything),
  SSR/static-generation emits e.g. `&#x27;` where the source had `'`,
  the browser stores that as completely literal text (never decoding
  it, because it's inside `<style>`), and React's hydration check
  compares against the raw un-escaped string it started with — a real
  `Text content did not match` / minified-#425 hydration error. Fix:
  `<style dangerouslySetInnerHTML={{ __html: \`...\` }} />` instead —
  skips the escaping entirely, matching what the browser actually
  stores. Found and fixed live via this exact driver on `src/app/
  page.tsx`'s landing-page `<style>` block (the only one of six
  occurrences in this codebase that currently has an apostrophe in its
  CSS — the other five were converted preemptively, same footgun,
  not yet tripped).

## Troubleshooting

- **`page.goto: net::ERR_ABORTED` immediately followed by "Target page,
  context or browser has been closed" on every subsequent command**:
  the stdin-close race above. Not a flaky browser — rerun once to
  confirm, then check the driver's `queue` chaining is intact.
- **Screenshot looks like a plain dark screen with just the SHEP.HERD
  wordmark, nothing else**: that's `SplashIntro.tsx`'s ~3.9s intro
  animation, not a broken page — `sleep` at least 4000ms after `nav`
  before screenshotting the landing page if you need the real content
  underneath.
- **`[console.error] Failed to load resource: ... 401 (Unauthorized)`
  on `/`**: expected with the dummy Supabase env vars — some component
  checks auth state on mount and gets a correct 401 against a fake
  backend. Not a bug; ignore it when using dummy credentials.
