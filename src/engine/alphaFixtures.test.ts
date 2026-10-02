import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import expectations from '../../examples/alpha-expectations.json';
import { parseDSL } from '../parser/dsl';
import { ProjectSession } from './projectSession';
import { createProject } from './projectFactory';
import { ProjectFileSerializer } from '../parser/project/projectFileSerializer';
import { ProjectFileParser } from '../parser/project/projectFileParser';

describe('A01.04 synthetic acceptance corpus (engine evidence, not UI acceptance)', () => {
  it.each(expectations)('$file parses its declared elements, endpoints and message order', (fixture) => {
    const text = readFileSync(new URL(`../../examples/${fixture.file}`, import.meta.url), 'utf8');
    const result = parseDSL(text);
    if (!result.success) throw new Error(JSON.stringify(result.errors));
    const diagram = result.diagram;
    const names = new Map(diagram.elements.map((element) => [element.id, element.properties.name]));
    expect(diagram.type).toBe(fixture.type);
    expect(Object.fromEntries(diagram.elements.map((element) => [element.properties.name, element.type])))
      .toEqual(fixture.elements);
    expect(diagram.connectors.map((link) => [link.type, names.get(link.sourceId), names.get(link.targetId)]))
      .toEqual(fixture.connections);
    expect(diagram.connectors.map((link) => link.label).filter(Boolean)).toEqual(fixture.requiredLabels);
    for (const [name, properties] of Object.entries(fixture.requiredProperties ?? {})) {
      expect(diagram.elements.find((element) => element.properties.name === name)?.properties).toMatchObject(properties);
    }

    const project = createProject('Synthetic acceptance');
    project.diagrams[diagram.id] = diagram;
    project.diagramTexts = { [diagram.id]: text };
    project.tree = [{ id: diagram.id, name: diagram.name, type: 'diagram', diagramType: diagram.type }];
    project.metadata.diagramIndex[diagram.id] = { id: diagram.id, name: diagram.name, type: diagram.type, parentFolderId: '' };
    const session = new ProjectSession(project, () => {});
    try {
      const reopened = ProjectFileParser.parseAll(ProjectFileSerializer.serialize(session.snapshot().project));
      if (!reopened.success) throw new Error(JSON.stringify(reopened.errors));
      expect(reopened.data.diagrams[diagram.id]).toEqual(diagram);
      expect(reopened.data.diagramTexts?.[diagram.id]).toBe(text);
    } finally { session.dispose(); }
    // The separate ownership oracle is intentionally not claimed as a passing
    // model contract: F2 currently loses parent identity (readinessRegression).
  });
});
