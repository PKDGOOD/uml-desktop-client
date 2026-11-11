import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import expectations from '../../examples/alpha-expectations.json';
import type { ProjectData, ProjectTreeNode } from '../types';
import { parseDSL } from '../parser/dsl';
import { checkProjectData } from '../parser/project/projectFileIO';
import { createExampleProject } from './projectFactory';
import { ProjectSession } from './projectSession';
import { findTextModelConflicts, resolveTextModelConflicts } from './textModelConflicts';

/** Every A01.04 fixture with its text, saved the way the session saves it. */
function corpus(): ProjectData {
  const project: ProjectData = {
    metadata: { name: 'Corpus', version: '1.0.0', createdAt: '', updatedAt: '', diagramIndex: {} },
    tree: [], diagrams: {}, diagramTexts: {}, sharedElements: {},
  };
  for (const fixture of expectations) {
    const text = readFileSync(new URL(`../../examples/${fixture.file}`, import.meta.url), 'utf8');
    const parsed = parseDSL(text);
    if (!parsed.success) throw new Error(fixture.file);
    const diagram = parsed.diagram;
    project.tree.push({ id: diagram.id, type: 'diagram', name: diagram.name, diagramType: diagram.type });
    project.diagrams[diagram.id] = diagram;
    project.diagramTexts![diagram.id] = text;
    project.metadata.diagramIndex[diagram.id] = { id: diagram.id, name: diagram.name, type: diagram.type, parentFolderId: '' };
  }
  return project;
}

const classId = (project: ProjectData) => Object.values(project.diagrams).find((d) => d.type === 'class')!.id;

describe('A03.09 stored text/model conflicts', () => {
  it('finds none in the fixture corpus, the examples, or after text and canvas edits', () => {
    expect(findTextModelConflicts(corpus())).toEqual([]);
    expect(findTextModelConflicts(createExampleProject('Examples'))).toEqual([]);

    const session = new ProjectSession(corpus(), vi.fn());
    const id = classId(session.project);
    session.editText(id, `${session.text(id)}\n// a comment the model does not keep\n`);
    session.getSession(id)!.sync.flushPendingText();
    const element = session.project.diagrams[id].elements[0];
    expect(session.editCanvas(id, { type: 'element-move', elementId: element.id, position: { x: 999, y: 7 } })).toBe(true);
    const saved = session.snapshot().project;
    session.dispose();
    expect(findTextModelConflicts(saved)).toEqual([]);
  });

  it('does not treat a marked invalid draft as a conflict', () => {
    const project = corpus();
    project.diagramTexts![classId(project)] = '@class-diagram "Broken"\nclass {{{';
    expect(findTextModelConflicts(project)).toEqual([]);
  });

  it('ignores a stale diagram name in the header; the tree owns the name', () => {
    const project = corpus();
    const id = classId(project);
    project.diagramTexts![id] = project.diagramTexts![id].replace(/^@class-diagram "[^"]*"/m, '@class-diagram "Old name"');
    expect(findTextModelConflicts(project)).toEqual([]);
  });

  describe('a valid text that means something else', () => {
    function conflicted() {
      const project = corpus();
      const id = classId(project);
      // The text gains a class the model does not have; the model keeps a layout the text does not say.
      project.diagramTexts![id] = `${project.diagramTexts![id]}\nclass Invoice {\n  + total: number\n}\n`;
      project.diagrams[id].elements[0].position = { x: 777, y: 555 };
      return { project, id };
    }

    it('is reported with both candidates, matching IDs where names match', () => {
      const { project, id } = conflicted();
      const [conflict, ...rest] = findTextModelConflicts(project);
      expect(rest).toEqual([]);
      expect(conflict).toMatchObject({ diagramId: id, diagramName: project.diagrams[id].name });
      expect(conflict.model).toEqual(project.diagrams[id]);
      const first = project.diagrams[id].elements[0];
      expect(conflict.textModel.elements.find((e) => e.properties.name === first.properties.name)?.id).toBe(first.id);
      expect(conflict.textModel.elements.some((e) => e.properties.name === 'Invoice')).toBe(true);
    });

    it.each(['text', 'model'] as const)('resolves to the %s, leaves the original untouched and passes the Open rules', (choice) => {
      const { project, id } = conflicted();
      const original = structuredClone(project);
      const conflicts = findTextModelConflicts(project);
      const resolved = resolveTextModelConflicts(project, conflicts, { [id]: choice });

      expect(project).toEqual(original);
      expect(findTextModelConflicts(resolved)).toEqual([]);
      const hasInvoice = resolved.diagrams[id].elements.some((e) => e.properties.name === 'Invoice');
      expect(hasInvoice).toBe(choice === 'text');
      expect(resolved.diagrams[id].elements[0].position).toEqual(choice === 'text'
        ? conflicts[0].textModel.elements[0].position : { x: 777, y: 555 });
      if (choice === 'text') expect(resolved.diagramTexts![id]).toBe(project.diagramTexts![id]);
      expect(checkProjectData(resolved).success).toBe(true);
    });

    it('changes the diagram type in the tree and index when the chosen text declares another type', () => {
      const project = corpus();
      const id = classId(project);
      project.diagramTexts![id] = readFileSync(new URL('../../examples/alpha-activity.uml', import.meta.url), 'utf8');
      expect(parseDSL(project.diagramTexts![id]).success).toBe(true);
      const conflicts = findTextModelConflicts(project);
      expect(conflicts.map((c) => c.diagramId)).toEqual([id]);

      const resolved = resolveTextModelConflicts(project, conflicts, { [id]: 'text' });
      expect(resolved.diagrams[id].type).toBe('activity');
      expect(resolved.metadata.diagramIndex[id].type).toBe('activity');
      const find = (nodes: ProjectTreeNode[]): ProjectTreeNode | undefined => {
        for (const node of nodes) {
          const hit = node.id === id ? node : find(node.children ?? []);
          if (hit) return hit;
        }
        return undefined;
      };
      expect(find(resolved.tree)?.diagramType).toBe('activity');
      expect(checkProjectData(resolved).success).toBe(true);

      const kept = resolveTextModelConflicts(project, conflicts, { [id]: 'model' });
      expect(kept.diagrams[id].type).toBe('class');
      expect(checkProjectData(kept).success).toBe(true);
    });

    it('requires a choice for every conflict', () => {
      const { project } = conflicted();
      expect(() => resolveTextModelConflicts(project, findTextModelConflicts(project), {})).toThrow(/Choose the text or the diagram/);
    });
  });
});
