import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from '@/types';
import { createProject } from '../../engine/projectFactory';
import { nestedStateDiagram, reorderedSequenceDiagram, usecaseBoundaryDiagram } from '../../types/structureFixtures';
import { decodeProjectFile, encodeProjectFile } from './projectFileCodec';
import { ProjectFileSerializer } from './projectFileSerializer';

const writer = { app: 'UML Studio', version: '0.1.0' };

function documentFixture(): ProjectDocument {
  const state = structuredClone(nestedStateDiagram);
  state.viewport = { x: -120.5, y: 40, zoom: 1.75 };
  state.elements[1].position = { x: 150, y: 40 };
  state.elements[1].size = { width: 450, height: 300 };
  state.connectors[1].waypoints = [{ x: 300, y: 220 }, { x: 640, y: 220 }];
  state.elements[3].properties.stereotype = 'terminal';
  return {
    project: { id: '3f0c2a52-8a51-4d3e-9a0e-2a3c7f1d9b10', name: '주문 서비스',
      createdAt: '2026-10-27T09:00:00.000Z', updatedAt: '2026-10-27T09:30:00.000Z' },
    tree: [{ id: 'f-root', type: 'folder', name: '주문 서비스', expanded: true, children: [
      { id: 'd-state', type: 'diagram', name: 'Nested state', diagramType: 'state' },
      { id: 'f-sub', type: 'folder', name: 'More', expanded: false, children: [
        { id: 'd-usecase', type: 'diagram', name: 'Boundary', diagramType: 'usecase' },
        { id: 'd-sequence', type: 'diagram', name: 'Reordered', diagramType: 'sequence' },
      ] },
    ] }],
    diagrams: {
      'd-state': { model: state, text: '@state-diagram "Nested state"\n// kept comment\n', textStatus: 'in-sync' },
      'd-usecase': { model: structuredClone(usecaseBoundaryDiagram),
        text: '@usecase-diagram "Boundary"\nusecase "unterminated\n', textStatus: 'invalid' },
      'd-sequence': { model: structuredClone(reorderedSequenceDiagram), text: '', textStatus: 'in-sync' },
    },
    sharedElements: { 'shared-1': structuredClone(nestedStateDiagram.elements[0]) },
  };
}

function withFile(change: (file: Record<string, any>) => void): string {
  const file = JSON.parse(encodeProjectFile(documentFixture(), writer));
  change(file);
  return JSON.stringify(file);
}

function errorFor(content: string) {
  const result = decodeProjectFile(content);
  if (result.success) throw new Error('expected the file to be rejected');
  return result.errors;
}

describe('A02.04 schema-2 project file codec', () => {
  it('round-trips IDs, raw drafts, last valid models and presentation metadata', () => {
    const document = documentFixture();

    const decoded = decodeProjectFile(encodeProjectFile(document, writer));

    if (!decoded.success) throw new Error(JSON.stringify(decoded.errors));
    expect(decoded.data.document).toEqual(document);
    expect(decoded.data.writer).toEqual(writer);
  });

  it('writes the envelope header with schema and app versions kept apart', () => {
    const file = JSON.parse(encodeProjectFile(documentFixture(), { app: 'UML Studio', version: '9.9.9' }));

    expect(Object.keys(file)).toEqual(['format', 'schemaVersion', 'writer', 'project', 'tree', 'diagrams', 'sharedElements']);
    expect(file).toMatchObject({ format: 'uml-studio.project', schemaVersion: 2, writer: { version: '9.9.9' } });
    expect(file).not.toHaveProperty('metadata');
    expect(file).not.toHaveProperty('diagramTexts');
  });

  it('decodes into a copy that does not share objects with the encoded document', () => {
    const document = documentFixture();
    const decoded = decodeProjectFile(encodeProjectFile(document, writer));
    if (!decoded.success) throw new Error(JSON.stringify(decoded.errors));

    decoded.data.document.diagrams['d-state'].model.elements[0].position.x = 999;

    expect(document.diagrams['d-state'].model.elements[0].position.x).toBe(0);
  });

  it('opens the ADR 0001 example file', () => {
    const example = {
      format: 'uml-studio.project', schemaVersion: 2, writer,
      project: { id: '3f0c2a52-8a51-4d3e-9a0e-2a3c7f1d9b10', name: 'Order service',
        createdAt: '2026-10-27T09:00:00.000Z', updatedAt: '2026-10-27T09:30:00.000Z' },
      tree: [{ id: 'f-root', type: 'folder', name: 'Order service', children: [
        { id: 'd-classes', type: 'diagram', name: 'Domain', diagramType: 'class' }] }],
      diagrams: { 'd-classes': {
        model: { id: 'd-classes', name: 'Domain', type: 'class', elements: [], connectors: [], viewport: { x: 0, y: 0, zoom: 1 } },
        text: '@class-diagram "Domain"\n', textStatus: 'in-sync' } },
      sharedElements: {},
    };

    expect(decodeProjectFile(JSON.stringify(example)).success).toBe(true);
  });

  it.each([
    ['a future schema version', (f: Record<string, any>) => { f.schemaVersion = 3; }, 'newer version of UML Studio (file format 3)'],
    ['a string schema version', (f: Record<string, any>) => { f.schemaVersion = '2'; }, 'Invalid schema version'],
    ['a fractional schema version', (f: Record<string, any>) => { f.schemaVersion = 2.5; }, 'Invalid schema version'],
    ['another format', (f: Record<string, any>) => { f.format = 'something-else'; }, 'Not a UML Studio project file'],
    ['a missing project ID', (f: Record<string, any>) => { delete f.project.id; }, 'Missing required field: project.id'],
    ['a missing writer', (f: Record<string, any>) => { delete f.writer; }, 'Missing required field: writer'],
    ['an unknown text status', (f: Record<string, any>) => { f.diagrams['d-state'].textStatus = 'dirty'; }, 'Invalid diagram: d-state'],
    ['missing draft text', (f: Record<string, any>) => { delete f.diagrams['d-usecase'].text; }, 'Invalid diagram: d-usecase'],
    ['a model ID that differs from its key', (f: Record<string, any>) => { f.diagrams['d-state'].model.id = 'other'; }, 'Invalid diagram: d-state'],
  ])('rejects %s', (_name, change, message) => {
    expect(errorFor(withFile(change)).map((error) => error.message).join('\n')).toContain(message);
  });

  it('does not read a legacy schema-1 file; migration is a separate step', () => {
    const legacy = ProjectFileSerializer.serialize(createProject('Legacy'));

    expect(errorFor(legacy)[0]).toMatchObject({ path: 'metadata', message: expect.stringContaining('Legacy project file') });
  });

  it('rejects a file that is not JSON or not a project', () => {
    expect(errorFor('{ "format": ')[0].message).toContain('Invalid JSON');
    expect(errorFor('{}')[0].message).toBe('Not a UML Studio project file');
  });
});
