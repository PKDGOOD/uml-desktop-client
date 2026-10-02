// A01.10: headless reference measurements; not UI or disk-durability evidence.
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(root, '.artifacts.local'), { recursive: true });
const output = await fs.mkdtemp(path.join(root, '.artifacts.local', 'engine-baseline-'));
const entry = `
import assert from 'node:assert/strict';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { parseDSL } from './src/parser/dsl/index.ts';
import { serializeDSL } from './src/parser/dsl/serializer.ts';
import { ProjectFileParser } from './src/parser/project/projectFileParser.ts';
import { ProjectFileSerializer } from './src/parser/project/projectFileSerializer.ts';
import { ExportEngine } from './src/engine/exportEngine.ts';
function fixture(count, links, index = 0) {
  return { id: 'diagram-' + index, name: 'Synthetic ' + index, type: 'class', viewport: {x:0,y:0,zoom:1},
    elements: Array.from({length:count}, (_,i) => ({id:'e-'+i,type:'class',position:{x:(i%20)*240,y:Math.floor(i/20)*180},size:{width:200,height:140},properties:{name:'Class'+i,attributes:[{name:'id',type:'String',visibility:'private'}],methods:[]}})),
    connectors: Array.from({length:links}, (_,i) => ({id:'c-'+i,type:'association',sourceId:'e-'+(i%count),targetId:'e-'+((i+1+Math.floor(i/count))%count),label:'synthetic relation '+i,properties:{}})) };
}
function measure(action, iterations=20) {
  for(let i=0;i<3;i++) action();
  const samples=[];
  for(let i=0;i<iterations;i++){const start=performance.now();action();samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);
  return {samples:iterations,medianMs:+samples[Math.floor(iterations/2)].toFixed(2),p95Ms:+samples[Math.ceil(iterations*.95)-1].toFixed(2),maxMs:+samples.at(-1).toFixed(2)};
}
const result={kind:'Headless engine baseline: no native IO, UI latency, FPS or durability claim',node:process.version,platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,memoryGiB:Math.round(os.totalmem()/1024**3),diagrams:[]};
for(const [name,n,c] of [['typical',200,300],['stress',1000,2000]]){
  const d=fixture(n,c),text=serializeDSL(d);
  const parsed=parseDSL(text);assert.equal(parsed.success,true);assert.equal(parsed.diagram.elements.length,n);assert.equal(parsed.diagram.connectors.length,c);
  const svg=ExportEngine.exportSVG(d);
  result.diagrams.push({name,elements:n,connectors:c,jsonBytes:Buffer.byteLength(JSON.stringify(d)),dslBytes:Buffer.byteLength(text),svgBytes:Buffer.byteLength(svg),
    parse:measure(()=>{assert.equal(parseDSL(text).success,true)}),serialize:measure(()=>serializeDSL(d)),svg:measure(()=>ExportEngine.exportSVG(d))});
}
const project={metadata:{name:'20-diagram reference',version:'1.0.0',createdAt:'2026-09-27T00:00:00Z',updatedAt:'2026-09-27T00:00:00Z',diagramIndex:{}},tree:[],sharedElements:{},diagrams:{},diagramTexts:{}};
for(let i=0;i<20;i++){const d=fixture(200,300,i);project.diagrams[d.id]=d;project.diagramTexts[d.id]=serializeDSL(d);project.tree.push({id:d.id,name:d.name,type:'diagram',diagramType:'class'});project.metadata.diagramIndex[d.id]={id:d.id,name:d.name,type:'class',parentFolderId:''};}
const json=ProjectFileSerializer.serialize(project);
result.project={diagrams:20,elements:4000,connectors:6000,bytes:Buffer.byteLength(json),parse:measure(()=>{assert.equal(ProjectFileParser.parseAll(json).success,true)}),serialize:measure(()=>ProjectFileSerializer.serialize(project))};
console.log(JSON.stringify(result,null,2));
`;
const bundle = await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: 'baseline-entry.ts', loader: 'ts' },
  absWorkingDir: root, bundle: true, platform: 'node', format: 'cjs', write: false,
  plugins: [{ name: 'canonical-grammar-as-text', setup(builder) {
    builder.onResolve({ filter: /\.pegjs\?raw$/ }, (args) => ({ path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'grammar' }));
    builder.onLoad({ filter: /.*/, namespace: 'grammar' }, async (args) => ({ contents: await fs.readFile(args.path, 'utf8'), loader: 'text' }));
  } }],
});
const script = path.join(output, 'measurement.cjs');
await fs.writeFile(script, bundle.outputFiles[0].contents);
const measured = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
if (measured.error || measured.status !== 0) throw measured.error ?? new Error(measured.stderr);
const result = JSON.parse(measured.stdout);
result.bundleSha256 = createHash('sha256').update(bundle.outputFiles[0].contents).digest('hex');
await fs.writeFile(path.join(output, 'metrics.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output, ...result }, null, 2));
