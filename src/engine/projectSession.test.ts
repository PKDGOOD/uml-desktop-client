import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectSession } from './projectSession';
import { ProjectFileParser } from '../parser/project/projectFileParser';
import { ProjectFileSerializer } from '../parser/project/projectFileSerializer';
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
