// A01.09/A01.11: exercise the built application, real preload/IPC and filesystem.
// Only native picker answers are replaced, in an isolated inspected test process.
// This does NOT establish native-picker usability or signed-installer support.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const binary = process.argv.find((arg) => arg.startsWith('--app='))?.slice(6)
  ?? path.join(root, 'release/mac-arm64/UML Studio.app/Contents/MacOS/UML Studio');
const expectF5 = process.argv.includes('--expect-f5');
assert.equal(process.platform, 'darwin', 'This baseline harness currently validates macOS only.');
await fs.access(binary);
await fs.mkdir(path.join(root, '.artifacts.local'), { recursive: true });
const output = await fs.mkdtemp(path.join(root, '.artifacts.local', 'packaged-smoke-'));
const profile = path.join(output, 'profile');
await fs.mkdir(profile);
const projectPath = path.join(output, '주문 검증.uml.json');
const svgPath = path.join(output, 'order.svg');
const source = await fs.readFile(path.join(root, 'examples/alpha-class.uml'), 'utf8');
const report = { platform: `${os.platform()} ${os.release()} ${os.arch()}`, binary,
  nativeDialogs: 'Picker answers stubbed; real renderer, preload, IPC and file writes.', checks: [], knownFailures: [] };
const archive = path.resolve(binary, '../../Resources/app.asar');
report.appArchiveSha256 = createHash('sha256').update(await fs.readFile(archive)).digest('hex');
let running;
let lastPage;
const sockets = new Set();

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function until(label, predicate, timeout = 20000) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const value = await predicate(); if (value) return value; }
    catch (error) { last = error; }
    if (running?.exitCode !== null && running?.exitCode !== undefined) throw new Error(`App exited during ${label}`);
    await delay(100);
  }
  throw new Error(`Timed out: ${label}${last ? `: ${last.message}` : ''}`);
}

async function connect(url) {
  const socket = new WebSocket(url);
  sockets.add(socket);
  const pending = new Map();
  const events = [];
  let contextId;
  let counter = 0;
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method) events.push(message);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  socket.addEventListener('close', () => {
    sockets.delete(socket);
    for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(new Error('CDP closed')); }
    pending.clear();
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.close(); reject(new Error('CDP connection timeout')); }, 10000);
    socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('CDP connection failed')); }, { once: true });
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++counter;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, ...(contextId ? { contextId } : {}) });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  return { send, evaluate, events, setContext: (id) => { contextId = id; } };
}

async function targets(port) {
  return (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) })).json();
}

async function launch() {
  const inspector = await freePort();
  let renderer = await freePort();
  while (renderer === inspector) renderer = await freePort();
  const env = { ...process.env };
  delete env.VITE_DEV_SERVER_URL;
  delete env.ELECTRON_RUN_AS_NODE;
  running = spawn(binary, [`--inspect-brk=127.0.0.1:${inspector}`, '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${renderer}`, `--user-data-dir=${profile}`], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = '';
  running.stdout.on('data', (chunk) => { logs += chunk; });
  running.stderr.on('data', (chunk) => { logs += chunk; });
  running.on('error', (error) => { logs += error.message; });
  const target = await until('main inspector', async () => (await targets(inspector))[0]);
  const main = await connect(target.webSocketDebuggerUrl);
  await main.send('Runtime.enable');
  await main.send('Debugger.enable');
  await main.send('Runtime.runIfWaitingForDebugger');
  const paused = await until('main entry breakpoint', () => main.events.find((event) => event.method === 'Debugger.paused'));
  const frame = paused.params.callFrames[0];
  const script = main.events.find((event) => event.method === 'Debugger.scriptParsed' && event.params.scriptId === frame.location.scriptId);
  assert.ok(script, 'Main script must have an execution context');
  main.setContext(script.params.executionContextId);
  const initialized = await main.send('Debugger.evaluateOnCallFrame', { callFrameId: frame.callFrameId, expression: `
    globalThis.__smokeRequire = require;
    globalThis.__smokeElectron = require('electron');
    __smokeElectron.app.setPath('userData', ${JSON.stringify(profile)});
    __smokeElectron.dialog.showSaveDialog = async (_window, options) => ({ canceled: false,
      filePath: options.title === 'Export diagram' ? ${JSON.stringify(svgPath)} : ${JSON.stringify(projectPath)} });
    __smokeElectron.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [${JSON.stringify(projectPath)}] });
    __smokeElectron.dialog.showMessageBoxSync = () => 1;`, returnByValue: true });
  if (initialized.exceptionDetails) throw new Error(JSON.stringify(initialized.exceptionDetails));
  await main.send('Debugger.resume');
  const pageTarget = await until('packaged renderer', async () => (await targets(renderer))
    .find((item) => item.type === 'page' && item.url.startsWith('file:')));
  const page = await connect(pageTarget.webSocketDebuggerUrl);
  lastPage = page;
  await until('workspace', () => page.evaluate(`!!document.querySelector('.app-menubar')`));
  assert.equal(await main.evaluate('__smokeElectron.app.getPath("userData")'), profile);
  await page.evaluate('window.confirm = () => true');
  return { main, page, renderer, logs: () => logs };
}

async function stop() {
  for (const socket of [...sockets]) socket.close();
  if (running && running.exitCode === null) {
    const exited = once(running, 'exit');
    running.kill('SIGTERM');
    const timeout = setTimeout(() => running?.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(timeout);
  }
  running = undefined;
}

async function click(page, text, selector = 'button') {
  await until(`button ${text}`, () => page.evaluate(`(() => {
    const button = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((item) => item.textContent.trim() === ${JSON.stringify(text)} && !item.disabled);
    if (!button) return false; button.click(); return true;
  })()`));
}

async function create(page, button, name) {
  await click(page, button, '.app-menubar button');
  await until('create dialog', () => page.evaluate('!!document.querySelector("dialog[open] #create-name")'));
  await page.evaluate(`(() => {
    const input = document.querySelector('#create-name');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(name)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await click(page, 'Create', 'dialog button');
  await until('dialog closed', () => page.evaluate('!document.querySelector("dialog[open]")'));
}

async function replaceEditor(page, text) {
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await until('Monaco text input focus', () => page.evaluate(`(() => {
    const input = document.querySelector('.monaco-editor [role="textbox"]');
    if (!input) return false;
    input.focus();
    return document.activeElement === input;
  })()`));
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 4, windowsVirtualKeyCode: 65 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 4, windowsVirtualKeyCode: 65 });
  // Monaco's native EditContext treats CDP insertText as typed lines and applies
  // auto-indent. Dispatch a paste with its own data, without changing OS clipboard.
  await page.evaluate(`(() => {
    const data = new DataTransfer(); data.setData('text/plain', ${JSON.stringify(text)});
    document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  })()`);
  await until('parsed diagram', () => page.evaluate(`document.querySelector('.status-bar')?.textContent.includes('5 elements') && !document.querySelector('.dsl-error')`));
}

async function screenshot(page, name) {
  const image = await page.send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(output, name), Buffer.from(image.data, 'base64'));
}

try {
  let app = await launch();
  await create(app.page, 'New', 'Packaged 주문 QA');
  await create(app.page, '+ Diagram', 'Order QA');
  await replaceEditor(app.page, source);
  await click(app.page, 'Save', '.app-menubar button');
  await until('confirmed save', () => app.page.evaluate(`document.querySelector('.file-notice')?.textContent.includes('Project saved.')`));
  const saved = JSON.parse(await fs.readFile(projectPath, 'utf8'));
  assert.equal(saved.metadata.name, 'Packaged 주문 QA');
  const [diagramId] = Object.keys(saved.diagrams);
  assert.equal(saved.diagrams[diagramId].elements.length, 5);
  assert.equal(saved.diagramTexts[diagramId].trim(), source.trim());
  assert.equal(await app.page.evaluate('!!document.querySelector(".dirty-dot")'), false);
  report.checks.push('New project → new diagram → real Monaco text input → IPC save → exact draft on disk');
  await fs.writeFile(path.join(output, 'first-launch.log'), app.logs());
  await stop();

  app = await launch();
  await click(app.page, 'Open', '.app-menubar button');
  await until('reopened', () => app.page.evaluate(`document.querySelector('.file-notice')?.textContent.includes('Project opened.')`));
  await until('reopened content', () => app.page.evaluate(`document.querySelector('.status-bar')?.textContent.includes('5 elements')`));
  await click(app.page, 'Save', '.app-menubar button');
  await until('resaved', () => app.page.evaluate(`document.querySelector('.file-notice')?.textContent.includes('Project saved.')`));
  const reopened = JSON.parse(await fs.readFile(projectPath, 'utf8'));
  assert.deepEqual(reopened.diagrams, saved.diagrams);
  assert.deepEqual(reopened.diagramTexts, saved.diagramTexts);
  await click(app.page, 'Export SVG', '.app-menubar button');
  await until('SVG exists', async () => (await fs.readFile(svgPath, 'utf8')).includes('<svg'));
  assert.match(await fs.readFile(svgPath, 'utf8'), /OrderItem/);
  await until('export settled', () => app.page.evaluate(`![...document.querySelectorAll('.app-menubar button')]
    .find((button) => button.textContent.trim() === 'Export SVG')?.disabled`));
  await click(app.page, 'Fit All');
  await app.page.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  await screenshot(app.page, 'reopened.png');
  report.checks.push('New application process → real IPC open → resave semantic/draft equality → SVG file');

  await app.main.evaluate(`globalThis.__smokeBrowser = new __smokeElectron.BrowserWindow({ width: 1400, height: 900, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'smoke-browser' } });
    __smokeBrowser.loadFile(__smokeRequire('node:path').join(__smokeElectron.app.getAppPath(), 'dist/index.html'),
      { query: { 'smoke-browser': '1' } });`);
  const browserTarget = await until('browser-mode renderer', async () => (await targets(app.renderer))
    .find((item) => item.type === 'page' && item.url.includes('smoke-browser=1')));
  const browser = await connect(browserTarget.webSocketDebuggerUrl);
  lastPage = browser;
  await until('browser workspace', () => browser.evaluate(`!!document.querySelector('.app-menubar')`));
  assert.equal(await browser.evaluate('typeof window.electronAPI'), 'undefined');
  await browser.evaluate(`window.confirm = () => true; window.__blockedDownloads = 0;
    HTMLAnchorElement.prototype.click = function () { window.__blockedDownloads++; };`);
  await create(browser, 'New', 'Browser blocked download');
  await create(browser, '+ Diagram', 'Unsaved browser diagram');
  assert.equal(await browser.evaluate('!!document.querySelector(".dirty-dot")'), true);
  await click(browser, 'Save', '.app-menubar button');
  await until('download requested', () => browser.evaluate('window.__blockedDownloads === 1'));
  const browserState = await browser.evaluate(`({ dirty: !!document.querySelector('.dirty-dot'),
    notice: document.querySelector('.file-notice')?.textContent, requests: window.__blockedDownloads })`);
  report.browserSave = browserState;
  await screenshot(browser, 'browser-save.png');
  if (expectF5) {
    assert.equal(browserState.dirty, false, 'F5 no longer reproduces: remove --expect-f5 and verify the fixed contract.');
    report.knownFailures.push('F5: blocked browser download incorrectly cleared dirty state');
  } else {
    assert.equal(browserState.dirty, true, 'F5: a blocked download must retain unsaved state.');
    assert.match(browserState.notice, /Download requested.*Verify the file.*unsaved/);
    report.checks.push('Blocked browser download preserves dirty state');
    await create(browser, 'New', 'Browser clean project');
    assert.equal(await browser.evaluate('!!document.querySelector(".dirty-dot")'), false);
    await click(browser, 'Save', '.app-menubar button');
    await until('clean download requested', () => browser.evaluate('window.__blockedDownloads === 2'));
    const clean = await browser.evaluate(`({ dirty: !!document.querySelector('.dirty-dot'),
      notice: document.querySelector('.file-notice')?.textContent })`);
    assert.equal(clean.dirty, false);
    assert.match(clean.notice, /Download requested.*Verify the file before closing/);
    assert.doesNotMatch(clean.notice, /changes remain unsaved/);
    report.checks.push('Clean browser project does not claim nonexistent unsaved edits');
  }
  await fs.writeFile(path.join(output, 'second-launch.log'), app.logs());
  report.status = report.knownFailures.length ? 'baseline-with-known-failure' : 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error.stack;
  if (lastPage) {
    try {
      report.failedView = await lastPage.evaluate(`({ text: document.body.innerText,
        focus: document.activeElement?.outerHTML?.slice(0, 400) })`);
      await screenshot(lastPage, 'failure.png');
    } catch { /* The process may already have exited; keep the original failure. */ }
  }
  process.exitCode = 1;
} finally {
  await stop();
  await fs.writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, checks: report.checks, knownFailures: report.knownFailures, output, error: report.error, failedView: report.failedView }, null, 2));
}
