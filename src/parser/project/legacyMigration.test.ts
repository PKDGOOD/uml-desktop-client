import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ProjectData } from '@/types';
import expectations from '../../../examples/alpha-expectations.json';
import { parseDSL } from '../dsl/peggyParser';
import { serializeDSL } from '../dsl/serializer';
import { decodeProjectFile, encodeProjectFile } from './projectFileCodec';
import { ProjectFileSerializer } from './projectFileSerializer';
import { migrateLegacyProjectFile } from './legacyMigration';

const createdAt = '2026-01-02T03:04:05.000Z';
const updatedAt = '2026-01-03T03:04:05.000Z';

function fixtureText(file: string): string {
  return readFileSync(new URL(`../../../examples/${file}`, import.meta.url), 'utf8');
}

/** A schema-1 file holding every A01.04 fixture: two at top level, the rest in a nested folder. */
function legacyFixture(): ProjectData {
  const project: ProjectData = {
    metadata: { name: 'Legacy corpus', version: '1.0.0', createdAt, updatedAt, diagramIndex: {} },
    tree: [{ id: 'f-root', type: 'folder', name: 'Legacy corpus', expanded: true, children: [
      { id: 'f-sub', type: 'folder', name: 'Behaviour', expanded: false, children: [] },
    ] }],
    diagrams: {}, sharedElements: {}, diagramTexts: {},
  };
  expectations.forEach((fixture, position) => {
    const text = fixtureText(fixture.file);
    const result = parseDSL(text);
    if (!result.success) throw new Error(JSON.stringify(result.errors));
    const diagram = result.diagram;
    const parentFolderId = position < 2 ? 'f-root' : 'f-sub';
    const node = { id: diagram.id, type: 'diagram' as const, name: diagram.name, diagramType: diagram.type };
    if (position < 2) project.tree[0].children!.splice(position, 0, node);
    else project.tree[0].children![2].children!.push(node);
    project.diagrams[diagram.id] = diagram;
    project.diagramTexts![diagram.id] = text;
    project.metadata.diagramIndex[diagram.id] = { id: diagram.id, name: diagram.name, type: diagram.type, parentFolderId };
  });
  return project;
}

function sequentialIds(): () => string {
  let next = 0;
  return () => `migrated-${++next}`;
}

function migrate(content: string) {
  const result = migrateLegacyProjectFile(content, { createId: sequentialIds() });
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.data;
}

function errorsFor(project: ProjectData) {
  const result = migrateLegacyProjectFile(JSON.stringify(project), { createId: sequentialIds() });
  if (result.success) throw new Error('expected the legacy file to be refused');
  return result.errors;
}

describe('A02.06 legacy (schema 1) migration', () => {
  it('maps metadata, tree, models, drafts and shared elements into a schema-2 document', () => {
    const legacy = legacyFixture();
    legacy.sharedElements = { 'shared-1': structuredClone(Object.values(legacy.diagrams)[0].elements[0]) };

    const document = migrate(ProjectFileSerializer.serialize(legacy));

    expect(document.project).toEqual({ id: 'migrated-1', name: 'Legacy corpus', createdAt, updatedAt });
    expect(document.tree).toEqual(legacy.tree);
    expect(document.sharedElements).toEqual(legacy.sharedElements);
    expect(Object.keys(document.diagrams)).toEqual(Object.keys(legacy.diagrams));
    for (const [id, model] of Object.entries(legacy.diagrams)) {
      expect(document.diagrams[id]).toEqual({ model, text: legacy.diagramTexts![id], textStatus: 'in-sync' });
    }
  });

  it('is deterministic for the same file and injected ID generator', () => {
    const content = ProjectFileSerializer.serialize(legacyFixture());

    expect(migrate(content)).toEqual(migrate(content));
  });

  it('returns detached copies that later edits cannot share', () => {
    const content = ProjectFileSerializer.serialize(legacyFixture());
    const first = migrate(content);
    const second = migrate(content);
    const id = Object.keys(first.diagrams)[0];

    first.diagrams[id].model.elements[0].position.x = 999;
    first.tree[0].name = 'Changed';

    expect(second.diagrams[id].model.elements[0].position.x).not.toBe(999);
    expect(second.tree[0].name).toBe('Legacy corpus');
  });

  it('leaves the source file text byte-for-byte unchanged', () => {
    const content = ProjectFileSerializer.serialize(legacyFixture());
    const before = Buffer.from(content, 'utf8');

    migrate(content);

    expect(Buffer.from(content, 'utf8').equals(before)).toBe(true);
  });

  it('generates in-sync text from the model when the old file has no diagramTexts', () => {
    const legacy = legacyFixture();
    delete legacy.diagramTexts;

    const document = migrate(JSON.stringify(legacy));

    for (const [id, model] of Object.entries(legacy.diagrams)) {
      expect(document.diagrams[id]).toEqual({ model, text: serializeDSL(model), textStatus: 'in-sync' });
    }
  });

  it('generates text only for diagrams missing from a partial diagramTexts map', () => {
    const legacy = legacyFixture();
    const [kept, missing] = Object.keys(legacy.diagrams);
    delete legacy.diagramTexts![missing];

    const document = migrate(JSON.stringify(legacy));

    expect(document.diagrams[kept].text).toBe(legacy.diagramTexts![kept]);
    expect(document.diagrams[missing].text).toBe(serializeDSL(legacy.diagrams[missing]));
  });

  it('keeps an unparsable old draft verbatim and marks it invalid with the last valid model', () => {
    const legacy = legacyFixture();
    const id = Object.keys(legacy.diagrams)[0];
    const draft = `${legacy.diagramTexts![id]}\nclass "unterminated\n`;
    legacy.diagramTexts![id] = draft;

    const document = migrate(JSON.stringify(legacy));

    expect(document.diagrams[id]).toEqual({ model: legacy.diagrams[id], text: draft, textStatus: 'invalid' });
  });

  it('marks an empty old draft invalid instead of regenerating it', () => {
    const legacy = legacyFixture();
    const id = Object.keys(legacy.diagrams)[0];
    legacy.diagramTexts![id] = '';

    expect(migrate(JSON.stringify(legacy)).diagrams[id]).toMatchObject({ text: '', textStatus: 'invalid' });
  });

  it('accepts the two-part 1.0 version written by the bundled sample project', () => {
    const legacy = legacyFixture();
    legacy.metadata.version = '1.0';

    expect(migrate(JSON.stringify(legacy)).project.id).toBe('migrated-1');
  });

  it('produces a document the schema-2 codec writes and reads back unchanged', () => {
    const document = migrate(ProjectFileSerializer.serialize(legacyFixture()));

    const decoded = decodeProjectFile(encodeProjectFile(document, { app: 'UML Studio', version: '0.1.0' }));

    if (!decoded.success) throw new Error(JSON.stringify(decoded.errors));
    expect(decoded.data.document).toEqual(document);
  });

  it('accepts an index that agrees with the tree even when a tree rename left the old name', () => {
    const legacy = legacyFixture();
    const id = Object.keys(legacy.diagrams)[0];
    legacy.metadata.diagramIndex[id].name = 'Name before tree rename';

    expect(migrate(JSON.stringify(legacy)).tree).toEqual(legacy.tree);
  });

  it.each([
    ['999.0.0', /newer version.*999\.0\.0/],
    ['2.0.0', /newer version/],
    ['beta', /Invalid legacy file version/],
  ])('refuses legacy version %s', (version, message) => {
    const legacy = legacyFixture();
    legacy.metadata.version = version;

    expect(errorsFor(legacy)).toEqual([expect.objectContaining({ message: expect.stringMatching(message), path: 'metadata.version' })]);
  });

  it.each<[string, (project: ProjectData, id: string) => void]>([
    ['missing index entry (F4c)', (project, id) => { delete project.metadata.diagramIndex[id]; }],
    ['wrong parent folder', (project, id) => { project.metadata.diagramIndex[id].parentFolderId = ''; }],
    ['wrong diagram type', (project, id) => { project.metadata.diagramIndex[id].type = 'state'; }],
    ['mismatched entry ID', (project, id) => { project.metadata.diagramIndex[id].id = 'other'; }],
    ['entry absent from the tree', (project, id) => {
      project.metadata.diagramIndex.extra = { ...project.metadata.diagramIndex[id], id: 'extra' };
    }],
  ])('refuses a diagram index that disagrees with the tree: %s', (_name, mutate) => {
    const legacy = legacyFixture();
    const id = Object.keys(legacy.diagrams).find((key) => legacy.diagrams[key].type !== 'state')!;
    mutate(legacy, id);

    expect(errorsFor(legacy)).toEqual([expect.objectContaining({ path: expect.stringMatching(/^metadata\.diagramIndex\./) })]);
  });

  it('passes through legacy shape errors without assigning an ID', () => {
    const legacy = legacyFixture() as unknown as Record<string, unknown>;
    delete legacy.tree;
    let calls = 0;

    const result = migrateLegacyProjectFile(JSON.stringify(legacy), { createId: () => `id-${++calls}` });

    expect(result).toMatchObject({ success: false, errors: [{ path: 'tree' }] });
    expect(calls).toBe(0);
  });
});
