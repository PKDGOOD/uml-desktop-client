import { beforeAll, describe, expect, it } from 'vitest';
import { parseDSL } from '../parser/dsl';
import { serializeDSL } from '../parser/dsl/serializer';
import { ProjectFileParser } from '../parser/project/projectFileParser';
import { createProject } from './projectFactory';
import { SyncEngine } from './syncEngine';
import type { DiagramData, ElementProperties, ProjectData } from '../types';

function parse(text: string): DiagramData {
  const result = parseDSL(text);
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.diagram;
}

function engine(diagram: DiagramData): SyncEngine {
  const sync = new SyncEngine({ onDiagramUpdate: () => {}, onTextUpdate: () => {}, onErrors: () => {} });
  sync.setDiagram(diagram);
  return sync;
}

const classSource = '@class-diagram "Regression"\nclass Order {\n  - id: String\n}\n';
let propertiesAfterText: ElementProperties;
let serializedContainment: string;
let invalidCommandAccepted: boolean;
const invalidFiles: Record<string, boolean> = {};

// Setups are outside it.fails: parser/setup exceptions must fail the suite,
// rather than accidentally satisfying an expected-failure assertion.
beforeAll(() => {
  const propertyEngine = engine(parse(classSource));
  try {
    const id = propertyEngine.getDiagram()!.elements[0].id;
    expect(propertyEngine.onCanvasChange({ type: 'element-update', elementId: id,
      properties: { stereotype: 'entity', visibility: 'private' } })).toBe(true);
    expect(propertyEngine.getDiagram()!.elements[0].properties.stereotype).toBe('entity');
    propertyEngine.onTextChange(`${propertyEngine.getText()}\n`);
    expect(propertyEngine.flushPendingText()).toBe(true);
    propertiesAfterText = structuredClone(propertyEngine.getDiagram()!.elements[0].properties);
  } finally { propertyEngine.dispose(); }

  const nested = parse('@state-diagram "Containment"\ncomposite-state Active {\n  state Inside\n}\nstate Outside\n');
  expect(nested.elements.map((item) => item.properties.name)).toEqual(['Active', 'Inside', 'Outside']);
  serializedContainment = serializeDSL(nested);

  const invalidEngine = engine(parse(classSource));
  try {
    const id = invalidEngine.getDiagram()!.elements[0].id;
    invalidCommandAccepted = invalidEngine.onCanvasChange({ type: 'element-update', elementId: id,
      properties: { attributes: [{ name: 'bad name', type: 'String', visibility: 'private' }] } });
    if (invalidCommandAccepted) expect(parseDSL(invalidEngine.getText()).success).toBe(false);
  } finally { invalidEngine.dispose(); }

  const diagram = parse(classSource);
  const project = createProject('Malformed-file controls');
  project.diagrams[diagram.id] = diagram;
  project.tree = [{ id: diagram.id, type: 'diagram', name: diagram.name, diagramType: 'class' }];
  project.metadata.diagramIndex[diagram.id] = { id: diagram.id, name: diagram.name, type: 'class', parentFolderId: '' };
  expect(ProjectFileParser.parseAll(JSON.stringify(project)).success).toBe(true);
  const variants: Record<string, (copy: ProjectData) => void> = {
    'duplicate element ID': (p) => { p.diagrams[diagram.id].elements.push(structuredClone(diagram.elements[0])); },
    'missing connector endpoint': (p) => { p.diagrams[diagram.id].connectors.push({ id: 'broken-link', type: 'association',
      sourceId: diagram.elements[0].id, targetId: 'missing', properties: {} }); },
    'tree/index mismatch': (p) => { delete p.metadata.diagramIndex[diagram.id]; },
    'future file version': (p) => { p.metadata.version = '999.0.0'; },
  };
  for (const [name, mutate] of Object.entries(variants)) {
    const copy = structuredClone(project);
    mutate(copy);
    invalidFiles[name] = ProjectFileParser.parseAll(JSON.stringify(copy)).success;
  }
});

describe('OPEN readiness defects: expected failures are NOT supported behavior', () => {
  // Remove .fails in the linked fix task; unexpected success deliberately turns red.
  it('F1 / A01.05 → A04.04: preserve GUI properties after text whitespace edits', () => {
    expect(propertiesAfterText).toMatchObject({ stereotype: 'entity', visibility: 'private' });
  });
  it.fails('F2 / A01.06 → A04.07: keep Outside at top level after serialization', () => {
    expect(serializedContainment.split('\n').some((line) => /^state Outside(?:\s|$)/.test(line))).toBe(true);
  });
  it.fails('F3 / A01.07 → A03.07: reject an invalid member command before commit', () => {
    expect(invalidCommandAccepted).toBe(false);
  });
  for (const name of ['duplicate element ID', 'missing connector endpoint', 'tree/index mismatch', 'future file version']) {
    it.fails(`F4 / A01.08 → A03.08: reject ${name}`, () => {
      expect(invalidFiles[name]).toBe(false);
    });
  }
});
