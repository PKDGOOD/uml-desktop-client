import { describe, expect, it, vi } from 'vitest';
import type { ProjectData } from '@/types';
import { ProjectSession } from '../../engine/projectSession';
import { ProjectFileSerializer } from './projectFileSerializer';
import { PROJECT_LIMITS } from './projectFileLimits';
import { readProjectFile, writeProjectFile } from './projectFileIO';

const createId = () => 'fresh-id';

function legacy(): ProjectData {
  const element = (index: number) => ({
    id: `e${index}`, type: 'class' as const, properties: { name: `C${index}` },
    position: { x: index, y: 0 }, size: { width: 100, height: 60 },
  });
  return {
    metadata: { name: 'Limits', version: '1.0.0', createdAt: '', updatedAt: '', diagramIndex: {
      d: { id: 'd', name: 'D', type: 'class', parentFolderId: '' },
    } },
    tree: [{ id: 'd', type: 'diagram', name: 'D', diagramType: 'class' }],
    diagrams: { d: { id: 'd', name: 'D', type: 'class', elements: [element(1), element(2)], viewport: { x: 0, y: 0, zoom: 1 },
      connectors: [{ id: 'c', type: 'association', sourceId: 'e1', targetId: 'e2', properties: {}, waypoints: [{ x: 5, y: 5 }] }] } },
    sharedElements: {},
  };
}

function schema2(project = legacy()): Record<string, any> {
  const opened = readProjectFile(ProjectFileSerializer.serialize(project), { createId });
  if (!opened.success) throw new Error(JSON.stringify(opened.errors));
  const session = new ProjectSession(opened.data.project, vi.fn(), { projectId: 'p' });
  const content = writeProjectFile(session.documentSnapshot().document, { app: 'UML Studio', version: '0.1.0' });
  session.dispose();
  return JSON.parse(content);
}

function errors(content: string) {
  const result = readProjectFile(content, { createId });
  if (result.success) throw new Error('expected the file to be refused');
  return result.errors;
}

describe('A03.01 input ceilings and closed keys', () => {
  it('opens files at the limits', () => {
    const file = schema2();
    file.diagrams.d.model.elements[0].position = { x: PROJECT_LIMITS.coordinate, y: -PROJECT_LIMITS.coordinate };
    file.diagrams.d.model.elements[0].size = { width: PROJECT_LIMITS.extent, height: 1 };
    file.diagrams.d.model.viewport.zoom = PROJECT_LIMITS.maxZoom;
    expect(readProjectFile(JSON.stringify(file), { createId }).success).toBe(true);
  });

  it('refuses a file over 16 MiB before parsing it', () => {
    const content = `{"pad":"${'é'.repeat(PROJECT_LIMITS.fileBytes / 2)}"}`;
    expect(errors(content)).toEqual([{ message: expect.stringMatching(/larger than 16 MiB/) }]);
  });

  it.each<[string, (file: Record<string, any>) => void, string]>([
    ['too many diagrams', (file) => {
      for (let i = 0; i <= PROJECT_LIMITS.diagrams; i++) file.diagrams[`x${i}`] = file.diagrams.d;
    }, 'diagrams'],
    ['an oversized text', (file) => { file.diagrams.d.text = 'x'.repeat(PROJECT_LIMITS.textBytesPerDiagram + 1); }, 'diagrams.d.text'],
    ['too many elements', (file) => {
      file.diagrams.d.model.elements = Array.from({ length: PROJECT_LIMITS.elementsPerDiagram + 1 }, () => file.diagrams.d.model.elements[0]);
    }, 'diagrams.d.model.elements'],
    ['too many connectors', (file) => {
      file.diagrams.d.model.connectors = Array.from({ length: PROJECT_LIMITS.connectorsPerDiagram + 1 }, () => file.diagrams.d.model.connectors[0]);
    }, 'diagrams.d.model.connectors'],
    ['a far coordinate', (file) => { file.diagrams.d.model.elements[1].position.x = PROJECT_LIMITS.coordinate + 1; }, 'diagrams.d.model.elements[1].position'],
    ['an overflowing number', (file) => { file.diagrams.d.model.connectors[0].waypoints[0].y = '__INF__'; }, 'diagrams.d.model.connectors[0].waypoints[0]'],
    ['a zero size', (file) => { file.diagrams.d.model.elements[0].size.height = 0; }, 'diagrams.d.model.elements[0].size'],
    ['a huge size', (file) => { file.diagrams.d.model.elements[0].size.width = PROJECT_LIMITS.extent + 1; }, 'diagrams.d.model.elements[0].size'],
    ['an out-of-range zoom', (file) => { file.diagrams.d.model.viewport.zoom = 10; }, 'diagrams.d.model.viewport.zoom'],
    ['folders nested too deep', (file) => {
      let nodes = file.tree;
      for (let depth = 0; depth <= PROJECT_LIMITS.folderDepth + 1; depth++) {
        const folder = { id: `f${depth}`, type: 'folder', name: `F${depth}`, children: [] };
        nodes.push(folder);
        nodes = folder.children;
      }
    }, `tree[1]${'.children[0]'.repeat(PROJECT_LIMITS.folderDepth + 1)}`],
  ])('refuses %s', (_name, mutate, path) => {
    const file = schema2();
    mutate(file);
    // JSON cannot spell Infinity; 1e999 parses to it.
    const content = JSON.stringify(file).replace('"__INF__"', '1e999');
    expect(errors(content)).toContainEqual(expect.objectContaining({ path }));
  });

  it.each([
    ['envelope', (file: Record<string, any>) => { file.comments = []; }, 'comments'],
    ['writer', (file: Record<string, any>) => { file.writer.build = 1; }, 'writer.build'],
    ['project', (file: Record<string, any>) => { file.project.owner = 'x'; }, 'project.owner'],
    ['tree node', (file: Record<string, any>) => { file.tree[0].color = 'red'; }, 'tree[0].color'],
    ['diagram document', (file: Record<string, any>) => { file.diagrams.d.notes = ''; }, 'diagrams.d.notes'],
    ['element', (file: Record<string, any>) => { file.diagrams.d.model.elements[0].z = 1; }, 'diagrams.d.model.elements[0].z'],
    ['connector', (file: Record<string, any>) => { file.diagrams.d.model.connectors[0].color = 'red'; }, 'diagrams.d.model.connectors[0].color'],
  ])('refuses an unknown %s key', (_name, mutate, path) => {
    const file = schema2();
    mutate(file);
    expect(errors(JSON.stringify(file))).toEqual([{ message: expect.stringMatching(/^Unknown field/), path }]);
  });

  it('keeps unknown keys inside open properties bags', () => {
    const file = schema2();
    file.diagrams.d.model.elements[0].properties.custom = { any: 'thing' };
    const opened = readProjectFile(JSON.stringify(file), { createId });
    expect(opened.success && opened.data.project.diagrams.d.elements[0].properties.custom).toEqual({ any: 'thing' });
  });

  it('refuses unknown element keys in legacy files too, so a migrated save reopens', () => {
    const project = legacy() as unknown as Record<string, any>;
    project.diagrams.d.elements[0].z = 1;
    expect(errors(JSON.stringify(project))).toEqual([{ message: 'Unknown field: z', path: 'diagrams.d.elements[0].z' }]);
  });

  it('reports a newer schema before limits or unknown keys', () => {
    const file = schema2();
    file.schemaVersion = 3;
    file.comments = [];
    expect(errors(JSON.stringify(file))).toEqual([expect.objectContaining({ path: 'schemaVersion' })]);
  });

  it('refuses unknown keys in legacy diagram-index entries', () => {
    const project = legacy() as unknown as Record<string, any>;
    project.metadata.diagramIndex.d.color = 'red';
    expect(errors(JSON.stringify(project))).toEqual([{ message: 'Unknown field: color', path: 'metadata.diagramIndex.d.color' }]);
  });

  it('bounds the text migration generates for a legacy diagram without text', () => {
    const project = legacy();
    project.diagrams.d.elements[0].properties.name = 'A'.repeat(PROJECT_LIMITS.textBytesPerDiagram + 1);
    expect(errors(JSON.stringify(project))).toEqual([expect.objectContaining({ message: 'Diagram text is larger than 1 MiB' })]);
  });

  it('refuses a very deep tree without overflowing the stack', () => {
    const depth = 100_000;
    const node = '{"id":"f","type":"folder","name":"f","children":[';
    const file = schema2();
    const tree = node.repeat(depth) + ']}'.repeat(depth);
    const content = JSON.stringify({ ...file, tree: [] }).replace('"tree":[]', `"tree":[${tree}]`);
    expect(errors(content)).toEqual([expect.objectContaining({ message: expect.stringMatching(/nested at most/) })]);
  });
});
