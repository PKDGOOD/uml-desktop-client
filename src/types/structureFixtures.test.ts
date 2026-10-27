import { describe, expect, it } from 'vitest';
import expectations from '../../examples/alpha-expectations.json';
import { createProject } from '../engine/projectFactory';
import { ProjectFileParser } from '../parser/project/projectFileParser';
import { ProjectFileSerializer } from '../parser/project/projectFileSerializer';
import type { DiagramData } from './index';
import { nestedStateDiagram, reorderedSequenceDiagram, usecaseBoundaryDiagram } from './structureFixtures';

function ownerNames(diagram: DiagramData): Record<string, string | null> {
  const names = new Map(diagram.elements.map((element) => [element.id, element.properties.name]));
  return Object.fromEntries(diagram.elements.map((element) =>
    [element.properties.name, element.parentId ? names.get(element.parentId)! : null]));
}

function messageLabels(diagram: DiagramData): string[] {
  return diagram.connectors
    .filter((connector) => connector.messageOrder !== undefined)
    .sort((a, b) => a.messageOrder! - b.messageOrder!)
    .map((connector) => connector.label ?? '');
}

function oracle(file: string) {
  return expectations.find((fixture) => fixture.file === file)!;
}

describe('A02.03 explicit containment and message order (detached fixtures)', () => {
  it('state ownership comes from parentId, not from the element following a composite state', () => {
    const owners = ownerNames(nestedStateDiagram);

    expect(owners).toMatchObject(oracle('alpha-state.uml').ownership);
    expect(owners).toMatchObject({ Start: null, Active: null, Review: 'Active', Check: 'Review' });
  });

  it('use case ownership keeps a use case listed after the boundary outside it', () => {
    const owners = ownerNames(usecaseBoundaryDiagram);

    expect(owners).toMatchObject(oracle('alpha-usecase.uml').ownership);
    expect(owners.OrderSystem).toBeNull();
  });

  it('message order comes from messageOrder, not from connector array order', () => {
    const arrayOrder = reorderedSequenceDiagram.connectors.map((connector) => connector.label);

    expect(messageLabels(reorderedSequenceDiagram)).toEqual(oracle('alpha-sequence.uml').requiredLabels);
    expect(arrayOrder).not.toEqual(oracle('alpha-sequence.uml').requiredLabels);
    expect(reorderedSequenceDiagram.connectors.map((connector) => connector.messageOrder).sort((a, b) => a! - b!))
      .toEqual([1, 2, 3]);
  });

  it('elements without an owner and non-message connectors carry no structure fields', () => {
    const top = nestedStateDiagram.elements.find((element) => element.id === 's-outside')!;

    expect('parentId' in top).toBe(false);
    expect(nestedStateDiagram.connectors.every((connector) => !('messageOrder' in connector))).toBe(true);
  });

  it.each([nestedStateDiagram, usecaseBoundaryDiagram, reorderedSequenceDiagram])(
    '$name keeps parentId and messageOrder through a project file round trip', (diagram) => {
      const project = createProject('Structure fixtures');
      project.diagrams[diagram.id] = diagram;
      project.tree = [{ id: diagram.id, name: diagram.name, type: 'diagram', diagramType: diagram.type }];
      project.metadata.diagramIndex[diagram.id] = { id: diagram.id, name: diagram.name, type: diagram.type, parentFolderId: '' };

      const reopened = ProjectFileParser.parseAll(ProjectFileSerializer.serialize(project));

      if (!reopened.success) throw new Error(JSON.stringify(reopened.errors));
      expect(reopened.data.diagrams[diagram.id]).toEqual(diagram);
    });
});
