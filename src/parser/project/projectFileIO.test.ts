import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectData } from '@/types';
import expectations from '../../../examples/alpha-expectations.json';
import { ProjectSession } from '../../engine/projectSession';
import { parseDSL } from '../dsl/peggyParser';
import { ProjectFileSerializer } from './projectFileSerializer';
import { checkProjectData, readProjectFile, writeProjectFile } from './projectFileIO';

const writer = { app: 'UML Studio', version: '0.1.0' };
const createId = () => 'fresh-id';

/** Every A01.04 fixture as a schema-1 file, the way builds before schema 2 saved it. */
function legacyProject(): ProjectData {
  const project: ProjectData = {
    metadata: { name: 'Corpus', version: '1.0.0', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', diagramIndex: {} },
    tree: [{ id: 'folder', type: 'folder', name: 'Corpus', expanded: true, children: [] }],
    diagrams: {}, diagramTexts: {}, sharedElements: {},
  };
  for (const fixture of expectations) {
    const text = readFileSync(new URL(`../../../examples/${fixture.file}`, import.meta.url), 'utf8');
    const parsed = parseDSL(text);
    if (!parsed.success) throw new Error(fixture.file);
    const diagram = parsed.diagram;
    project.tree[0].children!.push({ id: diagram.id, type: 'diagram', name: diagram.name, diagramType: diagram.type });
    project.diagrams[diagram.id] = diagram;
    project.diagramTexts![diagram.id] = text;
    project.metadata.diagramIndex[diagram.id] = { id: diagram.id, name: diagram.name, type: diagram.type, parentFolderId: 'folder' };
  }
  return project;
}

function open(content: string) {
  const result = readProjectFile(content, { createId });
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.data;
}

function save(project: ProjectData, projectId: string, edit?: (session: ProjectSession) => void): string {
  const session = new ProjectSession(project, vi.fn(), { projectId });
  edit?.(session);
  const content = writeProjectFile(session.documentSnapshot().document, writer);
  session.dispose();
  return content;
}

describe('A02.08 project file Save/Open', () => {
  it('opens a legacy file as migrated with a fresh ID and the same content', () => {
    const legacy = legacyProject();
    const opened = open(ProjectFileSerializer.serialize(legacy));

    expect(opened).toMatchObject({ projectId: 'fresh-id', migrated: true, invalidDrafts: [] });
    expect(opened.project.tree).toEqual(legacy.tree);
    expect(opened.project.diagrams).toEqual(legacy.diagrams);
    expect(opened.project.diagramTexts).toEqual(legacy.diagramTexts);
    expect(opened.project.metadata.diagramIndex).toEqual(legacy.metadata.diagramIndex);
  });

  it('saves schema 2 and reopens it with the same ID, texts, models and tree', () => {
    const first = open(ProjectFileSerializer.serialize(legacyProject()));
    const content = save(first.project, first.projectId);
    expect(JSON.parse(content)).toMatchObject({ format: 'uml-studio.project', schemaVersion: 2, writer, project: { id: 'fresh-id' } });

    const reopened = open(content);
    expect(reopened).toMatchObject({ projectId: 'fresh-id', migrated: false, invalidDrafts: [] });
    const savedAt = reopened.project.metadata.updatedAt;
    expect(reopened.project).toEqual({ ...first.project, metadata: { ...first.project.metadata, updatedAt: savedAt } });
    vi.useFakeTimers({ now: new Date(savedAt) });
    try {
      expect(save(reopened.project, reopened.projectId)).toBe(content);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps an invalid draft verbatim next to its last valid model', () => {
    const first = open(ProjectFileSerializer.serialize(legacyProject()));
    const id = Object.keys(first.project.diagrams)[0];
    const draft = '@class-diagram "Broken"\nclass {{{';
    const reopened = open(save(first.project, first.projectId, (session) => session.editText(id, draft)));

    expect(reopened.invalidDrafts).toEqual([id]);
    expect(reopened.project.diagramTexts![id]).toBe(draft);
    expect(reopened.project.diagrams[id]).toEqual(first.project.diagrams[id]);
    const session = new ProjectSession(reopened.project, vi.fn());
    expect(session.getSession(id)!.sync.getErrors().length).toBeGreaterThan(0);
    session.dispose();
  });

  it('refuses broken references in a schema-2 file with the model path', () => {
    const first = open(ProjectFileSerializer.serialize(legacyProject()));
    const file = JSON.parse(save(first.project, first.projectId));
    const [id, diagram] = Object.entries(file.diagrams as Record<string, { model: ProjectData['diagrams'][string] }>)
      .find(([, entry]) => entry.model.connectors.length > 0)!;
    diagram.model.connectors[0].targetId = 'missing';

    const result = readProjectFile(JSON.stringify(file), { createId });
    expect(result).toMatchObject({ success: false, errors: [{ path: `diagrams.${id}.model.connectors[0].targetId` }] });
  });

  it.each([
    ['a newer schema', (file: Record<string, unknown>) => { file.schemaVersion = 3; }, /newer version/],
    ['damaged JSON', null, /Invalid JSON/],
  ])('refuses %s', (_name, mutate, message) => {
    const first = open(ProjectFileSerializer.serialize(legacyProject()));
    const file = JSON.parse(save(first.project, first.projectId));
    mutate?.(file);
    const content = mutate ? JSON.stringify(file) : '{"format":';
    const result = readProjectFile(content, { createId });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0].message).toMatch(message);
  });

  describe('A03.02 identity and tree rules', () => {
    function file() {
      const first = open(ProjectFileSerializer.serialize(legacyProject()));
      return JSON.parse(save(first.project, first.projectId));
    }
    const firstId = (content: Record<string, any>) => content.tree[0].children[0].id as string;

    it.each<[string, (content: Record<string, any>) => void, (content: Record<string, any>) => string]>([
      ['a model named differently from its tree node', (content) => { content.diagrams[firstId(content)].model.name = 'Other'; },
        (content) => `diagrams.${firstId(content)}.model.name`],
      ['a diagram node without a diagram type', (content) => { delete content.tree[0].children[0].diagramType; },
        () => 'tree[0].children[0].diagramType'],
      ['a diagram node with children', (content) => { content.tree[0].children[0].children = []; },
        () => 'tree[0].children[0].children'],
      ['a folder with a diagram type', (content) => { content.tree[0].diagramType = 'class'; }, () => 'tree[0].diagramType'],
    ])('refuses %s', (_name, mutate, path) => {
      const content = file();
      mutate(content);
      const result = readProjectFile(JSON.stringify(content), { createId });
      expect(result).toMatchObject({ success: false });
      if (!result.success) expect(result.errors).toContainEqual(expect.objectContaining({ path: path(content) }));
    });

    it('refuses a self-link in a schema-2 file with the model path (A03.04)', () => {
      const content = file();
      const id = firstId(content);
      const connector = content.diagrams[id].model.connectors[0];
      connector.targetId = connector.sourceId;
      const result = readProjectFile(JSON.stringify(content), { createId });
      expect(result).toMatchObject({ success: false });
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.objectContaining({
          path: `diagrams.${id}.model.connectors[0].targetId`, message: expect.stringMatching(/self-links/),
        }));
      }
    });

    it('refuses an invalid multiplicity in a legacy file (A03.03)', () => {
      const legacy = legacyProject();
      const [id, diagram] = Object.entries(legacy.diagrams).find(([, entry]) => entry.type === 'class')!;
      const index = diagram.connectors.findIndex((connector) => connector.sourceMultiplicity !== undefined);
      diagram.connectors[index].sourceMultiplicity = '3..1';
      const result = readProjectFile(ProjectFileSerializer.serialize(legacy), { createId });
      expect(result).toMatchObject({ success: false });
      if (!result.success) {
        expect(result.errors).toContainEqual(expect.objectContaining({
          path: `diagrams.${id}.connectors[${index}].sourceMultiplicity`, message: expect.stringMatching(/lower bound 3/),
        }));
      }
    });

    it('still opens a legacy file whose tree rename left the old model name', () => {
      const legacy = legacyProject();
      legacy.tree[0].children![0].name = 'Renamed';
      const opened = open(ProjectFileSerializer.serialize(legacy));
      expect(opened.project.diagrams[legacy.tree[0].children![0].id].name).toBe('Renamed');
    });
  });
});

describe('A03.08 checkProjectData before replacing a session', () => {
  it('accepts new, example and corpus projects as Open would load them', async () => {
    const { createProject, createExampleProject } = await import('../../engine/projectFactory');
    for (const project of [createProject('New'), createExampleProject('Examples'), legacyProject()]) {
      const result = checkProjectData(project);
      if (!result.success) throw new Error(JSON.stringify(result.errors));
      expect(result.data.project.diagrams).toEqual(project.diagrams);
      expect(result.data.project.tree).toEqual(project.tree);
    }
  });

  it.each<[string, (project: ProjectData) => void, RegExp]>([
    ['a self-link', (project) => {
      const diagram = Object.values(project.diagrams).find((entry) => entry.connectors.length > 0)!;
      diagram.connectors[0].targetId = diagram.connectors[0].sourceId;
    }, /self-links/],
    ['an unsupported element field', (project) => {
      (Object.values(project.diagrams)[0].elements[0] as unknown as Record<string, unknown>).locked = true;
    }, /locked/],
    ['a diagram missing from the tree', (project) => { project.tree[0].children!.pop(); }, /not in the tree/],
    ['too many diagrams', (project) => {
      const [id, diagram] = Object.entries(project.diagrams)[0];
      for (let i = 0; i < 20; i++) {
        const copy = `${id}-copy-${i}`;
        project.diagrams[copy] = { ...structuredClone(diagram), id: copy };
        project.tree[0].children!.push({ id: copy, type: 'diagram', name: diagram.name, diagramType: diagram.type });
        project.metadata.diagramIndex[copy] = { ...project.metadata.diagramIndex[id], id: copy };
      }
    }, /20/],
  ])('refuses %s without changing the candidate', (_name, mutate, message) => {
    const project = legacyProject();
    mutate(project);
    const before = structuredClone(project);
    const result = checkProjectData(project);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.map((error) => error.message).join('\n')).toMatch(message);
    expect(project).toEqual(before);
  });

  it('repairs a restored snapshot whose model name drifted from the tree, as Open does', () => {
    const project = legacyProject();
    const id = project.tree[0].children![0].id;
    project.tree[0].children![0].name = 'Renamed';
    project.metadata.diagramIndex[id].name = 'Renamed';
    const result = checkProjectData(project);
    if (!result.success) throw new Error(JSON.stringify(result.errors));
    expect(result.data.project.diagrams[id].name).toBe('Renamed');
    expect(result.data.project.diagramTexts?.[id]).toContain('"Renamed"');
  });
});
