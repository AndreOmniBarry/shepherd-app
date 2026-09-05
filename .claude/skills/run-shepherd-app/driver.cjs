#!/usr/bin/env node
// Minimal chromium-cli-shaped REPL driver for shepherd-app.
//
// Why this exists instead of the `chromium-cli` binary: that binary
// isn't installed in this container. Playwright itself IS available,
// but only as a global package (/opt/node22/lib/node_modules), and
// Node's ESM resolver does NOT honor NODE_PATH (only CommonJS
// `require` does) — confirmed by hand: `node --input-type=module -e
// "import {chromium} from 'playwright'"` with NODE_PATH set throws
// ERR_MODULE_NOT_FOUND, while the equivalent `require('playwright')`
// resolves fine. Hence: this file is CommonJS (.cjs), not .mjs.
//
// Usage:
//   NODE_PATH=/opt/node22/lib/node_modules node driver.cjs <session-name>
// then pipe newline-separated commands to stdin (or use tmux send-keys).
//
// Commands (subset of chromium-cli's shape):
//   nav <url>
//   wait-for text=<substring> | selector=<css>
//   screenshot [name]
//   click <css-selector>
//   fill <css-selector> <text...>
//   press <key>
//   eval <js-expression>
//   console            - print buffered console/page errors since last call
//   quit

const { chromium } = require('playwright');
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');

const session = process.argv[2] || 'app';
const dir = path.join(process.cwd(), '.claude/skills/run-shepherd-app/sessions', session, 'screenshots');
fs.mkdirSync(dir, { recursive: true });

let shotCount = 0;
const logs = [];

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // msg.text() alone leaves printf-style placeholders (%s etc.) from
  // multi-arg console.error/warn calls unfilled — React's hydration
  // warning is exactly this shape (`Text content did not match. Server:
  // "%s" Client: "%s"`) and msg.text() prints the literal "%s" with no
  // way to see what the actual mismatched values were. Resolving each
  // arg's jsonValue() and appending them is what actually shows the
  // real strings.
  page.on('console', async msg => {
    let extra = '';
    try {
      const args = await Promise.all(msg.args().map(a => a.jsonValue().catch(() => '<unserializable>')));
      if (args.length) extra = ' | args: ' + JSON.stringify(args);
    } catch { /* ignore */ }
    logs.push(`[console.${msg.type()}] ${msg.text()}${extra}`);
  });
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

  async function handle(line) {
    const [cmd, ...rest] = line.trim().split(/\s+/);
    const arg = rest.join(' ');
    try {
      if (!cmd) return;
      if (cmd === 'nav') {
        await page.goto(arg, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log(`OK nav ${arg}`);
      } else if (cmd === 'wait-for') {
        if (arg.startsWith('text=')) {
          await page.getByText(arg.slice(5), { exact: false }).first().waitFor({ timeout: 20000 });
        } else if (arg.startsWith('selector=')) {
          await page.waitForSelector(arg.slice(9), { timeout: 20000 });
        } else {
          await page.waitForSelector(arg, { timeout: 20000 });
        }
        console.log(`OK wait-for ${arg}`);
      } else if (cmd === 'screenshot') {
        const name = arg || `shot-${++shotCount}`;
        const file = path.join(dir, `${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`OK screenshot ${file}`);
      } else if (cmd === 'click') {
        await page.click(arg, { timeout: 10000 });
        console.log(`OK click ${arg}`);
      } else if (cmd === 'fill') {
        const [sel, ...text] = rest;
        await page.fill(sel, text.join(' '), { timeout: 10000 });
        console.log(`OK fill ${sel}`);
      } else if (cmd === 'press') {
        await page.keyboard.press(arg);
        console.log(`OK press ${arg}`);
      } else if (cmd === 'eval') {
        const result = await page.evaluate(new Function(`return (${arg})`));
        console.log(`OK eval -> ${JSON.stringify(result)}`);
      } else if (cmd === 'sleep') {
        await new Promise(r => setTimeout(r, parseInt(arg, 10) || 1000));
        console.log(`OK sleep ${arg}`);
      } else if (cmd === 'console') {
        console.log(logs.length ? logs.join('\n') : '(no console/page errors buffered)');
        logs.length = 0;
      } else if (cmd === 'quit') {
        await browser.close();
        process.exit(0);
      } else {
        console.log(`ERR unknown command: ${cmd}`);
      }
    } catch (err) {
      console.log(`ERR ${cmd} ${arg}: ${err.message.split('\n')[0]}`);
    }
  }

  // A heredoc closes stdin the instant all lines are written, which fires
  // readline's 'close' event almost immediately — well before the async
  // `handle()` calls for those lines have actually finished (readline
  // dispatches 'line' events without waiting on the handler). Without
  // this queue, 'close' would call browser.close() while the first `nav`
  // was still in flight, producing `net::ERR_ABORTED` on that nav and
  // "Target page ... has been closed" on every command after it. Chaining
  // handle() calls through one promise and awaiting that chain before
  // closing fixes it.
  let queue = Promise.resolve();
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', (line) => { queue = queue.then(() => handle(line)); });
  rl.on('close', async () => { await queue; await browser.close(); process.exit(0); });
})();
