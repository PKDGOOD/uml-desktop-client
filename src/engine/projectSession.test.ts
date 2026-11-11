import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectSession } from './projectSession';
import { parseDSL } from '../parser/dsl/peggyParser';
import { ProjectFileParser } from '../parser/project/projectFileParser';
import { ProjectFileSerializer } from '../parser/project/projectFileSerializer';
import { decodeProjectFile, encodeProjectFile } from '../parser/project/projectFileCodec';
import type { DiagramData, ProjectData } from '../types';

function project(): ProjectData {
  const diagram = (id: string): DiagramData => ({
    id, name: id, type: 'class', connectors: [], viewport: { x: 0, y: 0, zoom: 1 },
    elements: [{ id: `${id}-element`, type: 'class', properties: { name: 'Order' },
      position: { x: 10, y: 20 }, size: { width: 200, height: 100 } }],
  });
  return {
    metadata: { name: 'Test', version: '1.0', createdAt: '', updatedAt: '', diagramIndex: {
      one: { id: 'one', name: 'one', type: 'class', parentFolderId: '' },
      two: { id: 'two', name: 'two', type: 'class', parentFolderId: '' },
    } },
    tree: [
      { id: 'one', type: 'diagram', name: 'one', diagramType: 'class' },
      { id: 'two', type: 'diagram', name: 'two', diagramType: 'class' },
    ],
    diagrams: { one: diagram('one'), two: diagram('two') }, sharedElements: {},
  };
}

const draft = '@class-diagram "Edited"\n// Keep this comment\nclass Order {\n  - total: number\n}\n';

describe('ProjectSession editing and saving', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flushes the latest keystroke into a save without waiting for debounce', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', draft);
    const snapshot = session.snapshot();
    expect(snapshot.project.diagrams.one.elements[0].properties.attributes?.[0].name).toBe('total');
    expect(snapshot.project.diagramTexts?.one).toBe(draft);
    expect(snapshot.project.tree[0].name).toBe('Edited');
    expect(snapshot.project.metadata.diagramIndex.one.name).toBe('Edited');
  });

  it('does not send delayed text edits to a different diagram', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', draft);
    session.getSession('two');
    vi.advanceTimersByTime(300);
    expect(session.project.diagrams.one.name).toBe('Edited');
    expect(session.project.diagrams.two).toEqual(project().diagrams.two);
  });

  it('preserves independent undo histories after revisiting a diagram', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', draft);
    session.getSession('one')!.sync.flushPendingText();
    session.editCanvas('two', { type: 'element-move', elementId: 'two-element', position: { x: 80, y: 90 } });
    session.undo('one');
    expect(session.project.diagrams.one.name).toBe('one');
    expect(session.project.diagrams.two.elements[0].position).toEqual({ x: 80, y: 90 });
    session.redo('one');
    expect(session.text('one')).toBe(draft);
    session.undo('two');
    expect(session.project.diagrams.two.elements[0].position).toEqual({ x: 10, y: 20 });
  });

  it('saves and reopens invalid drafts together with their last valid canvas', () => {
    const session = new ProjectSession(project(), vi.fn());
    const invalid = '@class-diagram "unfinished"\nclass {{{';
    session.editText('one', invalid);
    const snapshot = session.snapshot();
    const parsed = ProjectFileParser.parseAll(ProjectFileSerializer.serialize(snapshot.project));
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error('Expected valid project file');
    const reopened = new ProjectSession(parsed.data, vi.fn());
    expect(reopened.text('one')).toBe(invalid);
    expect(reopened.getSession('one')!.sync.getErrors().length).toBeGreaterThan(0);
    expect(reopened.project.diagrams.one).toEqual(project().diagrams.one);
    expect(reopened.editCanvas('one', { type: 'element-delete', elementId: 'one-element' })).toBe(false);
    expect(reopened.text('one')).toBe(invalid);
  });

  it('keeps comments and whitespace through save/open and text undo/redo', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', draft);
    session.snapshot();
    session.editText('one', draft.replace('number', 'string'));
    session.snapshot();
    session.undo('one');
    expect(session.text('one')).toBe(draft);
    session.redo('one');
    const saved = session.snapshot();
    const parsed = ProjectFileParser.parseAll(ProjectFileSerializer.serialize(saved.project));
    if (!parsed.success) throw new Error('Expected valid project file');
    expect(new ProjectSession(parsed.data, vi.fn()).text('one')).toBe(draft.replace('number', 'string'));
  });

  it('does not mark edits made during an async save as saved or replace them', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', draft);
    const saving = session.snapshot();
    session.editText('one', draft.replace('number', 'string'));
    session.markSaved(saving.revision, saving.project.metadata.updatedAt);
    expect(session.dirty).toBe(true);
    expect(session.text('one')).toContain('string');
    expect(saving.project.diagramTexts?.one).toBe(draft);
    const latest = session.snapshot();
    session.markSaved(latest.revision, latest.project.metadata.updatedAt);
    expect(session.dirty).toBe(false);
  });

  it('includes property edits in undo history', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editCanvas('one', { type: 'element-update', elementId: 'one-element', properties: { name: 'Changed' } });
    expect(session.text('one')).toContain('Changed');
    session.undo('one');
    expect(session.project.diagrams.one.elements[0].properties.name).toBe('Order');
  });

  it('cancels old project callbacks when a project is replaced', () => {
    const onChange = vi.fn();
    const session = new ProjectSession(project(), onChange);
    session.editText('one', draft);
    onChange.mockClear();
    session.dispose();
    vi.runAllTimers();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('ProjectSession diagram rename', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const renamedTree = (name: string) => project().tree.map((node) => (node.id === 'one' ? { ...node, name } : node));

  function expectRenamed(session: ProjectSession, name: string) {
    expect(session.project.diagrams.one.name).toBe(name);
    expect(session.project.metadata.diagramIndex.one.name).toBe(name);
    expect(session.project.tree[0].name).toBe(name);
    expect(session.text('one').startsWith(`@class-diagram ${JSON.stringify(name)}`)).toBe(true);
  }

  it('renames an unopened diagram everywhere', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.setTree(renamedTree('Orders'));
    expectRenamed(session, 'Orders');
    expect(session.getSession('one')!.sync.getErrors()).toEqual([]);
    expect(session.project.diagrams.two.name).toBe('two');
  });

  it('renames an open diagram and keeps its comments and elements', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', draft);
    session.setTree(renamedTree('Billing "v2"'));
    expectRenamed(session, 'Billing "v2"');
    expect(session.text('one')).toContain('// Keep this comment');
    expect(session.project.diagrams.one.elements[0].properties.attributes?.[0].name).toBe('total');
  });

  it('rewrites a header that follows leading comments', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', '// header note\n' + draft);
    session.setTree(renamedTree('Orders'));
    expect(session.text('one').startsWith('// header note\n@class-diagram "Orders"')).toBe(true);
    expect(session.project.diagrams.one.name).toBe('Orders');
  });

  it('renames the model even while the draft is invalid', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', '@class-diagram "one"\nclass {{{');
    session.setTree(renamedTree('Orders'));
    expect(session.text('one')).toBe('@class-diagram "Orders"\nclass {{{');
    expect(session.project.diagrams.one.name).toBe('Orders');
    expect(session.project.metadata.diagramIndex.one.name).toBe('Orders');
    expect(session.project.tree[0].name).toBe('Orders');
  });

  it('survives save and reopen with matching names', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.setTree(renamedTree('Orders'));
    const parsed = ProjectFileParser.parseAll(ProjectFileSerializer.serialize(session.snapshot().project));
    if (!parsed.success) throw new Error('Expected valid project file');
    const reopened = new ProjectSession(parsed.data, vi.fn());
    expect(reopened.getSession('one')!.sync.getErrors()).toEqual([]);
    expectRenamed(reopened, 'Orders');
  });
});

describe('ProjectSession snapshot boundary (A02.05)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const invalid = '@class-diagram "one"\nclass {{{';

  it('captures text, last valid model, status and a stable project ID', () => {
    const session = new ProjectSession(project(), vi.fn(), { projectId: 'p-1' });
    session.editText('one', draft);
    const { document, diagnostics, revision } = session.documentSnapshot();
    expect(document.project.id).toBe('p-1');
    expect(document.diagrams.one).toMatchObject({ text: draft, textStatus: 'in-sync', model: { name: 'Edited' } });
    expect(document.diagrams.two.textStatus).toBe('in-sync');
    expect(document.diagrams.two.text).toBe(session.text('two'));
    expect(diagnostics).toEqual({});
    expect(revision).toBe(session.revision);
    expect(session.documentSnapshot().document.project.id).toBe('p-1');
  });

  it('keeps an invalid draft with its last valid model and diagnostics, then turns in-sync when fixed', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', invalid);
    const broken = session.documentSnapshot();
    expect(broken.document.diagrams.one).toMatchObject({ text: invalid, textStatus: 'invalid' });
    expect(broken.document.diagrams.one.model).toEqual(project().diagrams.one);
    expect(broken.diagnostics.one.length).toBeGreaterThan(0);

    session.editText('one', draft);
    const fixed = session.documentSnapshot();
    expect(fixed.document.diagrams.one).toMatchObject({ text: draft, textStatus: 'in-sync', model: { name: 'Edited' } });
    expect(fixed.diagnostics).toEqual({});
    expect(fixed.revision).toBeGreaterThan(broken.revision);
  });

  it('marks an invalid stored draft of an unopened diagram as invalid', () => {
    const source = project();
    source.diagramTexts = { two: invalid };
    const session = new ProjectSession(source, vi.fn());
    const { document, diagnostics } = session.documentSnapshot();
    expect(document.diagrams.two).toMatchObject({ text: invalid, textStatus: 'invalid' });
    expect(Object.keys(diagnostics)).toEqual(['two']);
  });

  it('is detached in both directions', () => {
    const session = new ProjectSession(project(), vi.fn());
    const snapshot = session.documentSnapshot();
    snapshot.document.diagrams.one.model.elements[0].position.x = 999;
    snapshot.document.tree[0].name = 'mutated';
    expect(session.project.diagrams.one.elements[0].position.x).toBe(10);
    expect(session.project.tree[0].name).toBe('one');

    session.editText('one', draft);
    session.editCanvas('two', { type: 'element-move', elementId: 'two-element', position: { x: 80, y: 90 } });
    expect(snapshot.document.diagrams.one.text).not.toBe(draft);
    expect(snapshot.document.diagrams.two.model.elements[0].position).toEqual({ x: 10, y: 20 });
  });

  it('acknowledges only the revision that was captured', () => {
    const session = new ProjectSession(project(), vi.fn());
    session.editText('one', draft);
    const { revision } = session.documentSnapshot();
    session.editCanvas('two', { type: 'element-move', elementId: 'two-element', position: { x: 80, y: 90 } });
    session.markSaved(revision, '2026-11-11T00:00:00.000Z');
    expect(session.dirty).toBe(true);
    session.markSaved(session.documentSnapshot().revision, '2026-11-11T00:00:01.000Z');
    expect(session.dirty).toBe(false);
  });

  it('produces a document the schema-2 codec writes and reads back', () => {
    const session = new ProjectSession(project(), vi.fn(), { projectId: 'p-1' });
    session.editText('one', invalid);
    const { document } = session.documentSnapshot();
    const decoded = decodeProjectFile(encodeProjectFile(document, { app: 'UML Studio', version: '0.1.0' }));
    if (!decoded.success) throw new Error(JSON.stringify(decoded.errors));
    expect(decoded.data.document).toEqual(document);
  });
});

describe('ProjectSession review follow-ups', () => {
  it('renames a header written without a space before the name', () => {
    const source = project();
    source.diagramTexts = { one: '@class-diagram"one"\nclass Order {\n}\n' };
    const session = new ProjectSession(source, vi.fn());
    session.setTree(source.tree.map((node) => (node.id === 'one' ? { ...node, name: 'Orders' } : node)));
    expect(session.text('one').startsWith('@class-diagram "Orders"')).toBe(true);
    expect(session.project.diagrams.one.name).toBe('Orders');
  });

  it('reports generated text of an unopened diagram that does not parse', () => {
    const source = project();
    source.diagrams.two.elements[0].properties.attributes = [{ name: 'has space', type: 'int', visibility: 'private' }];
    const session = new ProjectSession(source, vi.fn());
    const { document, diagnostics } = session.documentSnapshot();
    expect(parseDSL(document.diagrams.two.text).success).toBe(false);
    expect(document.diagrams.two.textStatus).toBe('invalid');
    expect(diagnostics.two.length).toBeGreaterThan(0);
  });
});
