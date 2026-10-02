import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import peggy from 'peggy';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const required = ['README.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md', 'GOVERNANCE.md', 'SUPPORT.md', 'CHANGELOG.md'];
for (const file of required) if (!(await read(file)).trim()) throw new Error(`Empty required document: ${file}`);
const pkg = JSON.parse(await read('package.json'));
const locked = JSON.parse(await read('package-lock.json')).packages[''];
for (const key of ['name', 'version', 'dependencies', 'devDependencies', 'engines']) {
  if (JSON.stringify(pkg[key]) !== JSON.stringify(locked[key])) throw new Error(`Lockfile mismatch: ${key}`);
}
const documents = [...required];
async function collect(directory) {
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await collect(file);
    else if (entry.name.endsWith('.md')) documents.push(file);
  }
}
await collect('docs');
for (const file of documents) {
  // Ignore fenced examples; validate local file destinations, not remote availability or anchors.
  const text = (await read(file)).replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
  for (const [, target] of text.matchAll(/\]\(([^\s)]+)\)/g)) {
    if (/^(?:[a-z]+:|#)/i.test(target)) continue;
    const dest = path.resolve(root, path.dirname(file), decodeURIComponent(target.split('#')[0]));
    await fs.access(dest).catch(() => { throw new Error(`Broken local link: ${file} → ${target}`); });
  }
}
const parser = peggy.generate(await read('src/parser/dsl/uml.pegjs'));
const examples = (await fs.readdir(path.join(root, 'examples'))).filter((name) => name.endsWith('.uml'));
if (!examples.length) throw new Error('No runnable DSL example');
for (const example of examples) {
  const diagram = parser.parse(await read(`examples/${example}`));
  const ids = new Set(diagram.elements.map((element) => element.id));
  if (!diagram.elements.length || diagram.connectors.some((link) => !ids.has(link.sourceId) || !ids.has(link.targetId))) {
    throw new Error(`Invalid example references: ${example}`);
  }
}
console.log(`Checked ${documents.length} documentation files, package metadata, and ${examples.length} DSL example(s).`);
