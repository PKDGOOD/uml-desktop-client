import { describe, it, expect, beforeEach } from 'vitest';
import { useDiagramStore } from './diagramStore';
import type { DiagramData, DiagramElement, Connector, Position } from '../types';

// --- Helpers ---

function makeDiagram(overrides?: Partial<DiagramData>): DiagramData {
  return {
    id: 'diagram-1',
    name: 'Test Diagram',
    type: 'class',
    elements: [],
    connectors: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  };
}

function makeElement(id: string, overrides?: Partial<DiagramElement>): DiagramElement {
  return {
    id,
    type: 'class',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    properties: { name: `Element_${id}` },
    ...overrides,
  };
}

function makeConnector(
  id: string,
  sourceId: string,
  targetId: string,
  overrides?: Partial<Connector>,
): Connector {
  return {
    id,
    type: 'association',
    sourceId,
    targetId,
    properties: {},
    ...overrides,
  };
}

describe('diagramStore', () => {
  beforeEach(() => {
    useDiagramStore.getState().reset();
  });

  // --- Initial state ---

  it('should initialize with null diagram', () => {
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  // --- setDiagram ---

  it('should set the active diagram', () => {
    const diagram = makeDiagram();
    useDiagramStore.getState().setDiagram(diagram);
    expect(useDiagramStore.getState().diagram).toEqual(diagram);
  });

  // --- getDiagram ---

  it('should return null when no diagram is set', () => {
    expect(useDiagramStore.getState().getDiagram()).toBeNull();
  });

  it('should return the current diagram', () => {
    const diagram = makeDiagram();
    useDiagramStore.getState().setDiagram(diagram);
    expect(useDiagramStore.getState().getDiagram()).toEqual(diagram);
  });

  // --- addElement ---

  it('should add an element to the diagram', () => {
    useDiagramStore.getState().setDiagram(makeDiagram());
    const el = makeElement('e1');
    useDiagramStore.getState().addElement(el);
    expect(useDiagramStore.getState().diagram!.elements).toEqual([el]);
  });

  it('should not crash when adding element with no diagram', () => {
    useDiagramStore.getState().addElement(makeElement('e1'));
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  // --- moveElement ---

  it('should move an element to a new position', () => {
    const el = makeElement('e1');
    useDiagramStore.getState().setDiagram(makeDiagram({ elements: [el] }));
    const newPos: Position = { x: 200, y: 300 };
    useDiagramStore.getState().moveElement('e1', newPos);
    expect(useDiagramStore.getState().diagram!.elements[0].position).toEqual(newPos);
  });

  it('should not modify other elements when moving', () => {
    const e1 = makeElement('e1');
    const e2 = makeElement('e2', { position: { x: 50, y: 50 } });
    useDiagramStore.getState().setDiagram(makeDiagram({ elements: [e1, e2] }));
    useDiagramStore.getState().moveElement('e1', { x: 999, y: 999 });
    expect(useDiagramStore.getState().diagram!.elements[1].position).toEqual({ x: 50, y: 50 });
  });

  // --- resizeElement ---

  it('should resize an element', () => {
    const el = makeElement('e1');
    useDiagramStore.getState().setDiagram(makeDiagram({ elements: [el] }));
    useDiagramStore.getState().resizeElement('e1', { width: 200, height: 150 });
    expect(useDiagramStore.getState().diagram!.elements[0].size).toEqual({
      width: 200,
      height: 150,
    });
  });

  // --- updateElementProperties ---

  it('should update element properties with partial merge', () => {
    const el = makeElement('e1', {
      properties: { name: 'MyClass', stereotype: 'entity' },
    });
    useDiagramStore.getState().setDiagram(makeDiagram({ elements: [el] }));
    useDiagramStore.getState().updateElementProperties('e1', { name: 'Renamed' });
    const props = useDiagramStore.getState().diagram!.elements[0].properties;
    expect(props.name).toBe('Renamed');
    expect(props.stereotype).toBe('entity');
  });

  // --- deleteElement (cascade) ---

  it('should delete an element', () => {
    const el = makeElement('e1');
    useDiagramStore.getState().setDiagram(makeDiagram({ elements: [el] }));
    useDiagramStore.getState().deleteElement('e1');
    expect(useDiagramStore.getState().diagram!.elements).toEqual([]);
  });

  it('should cascade-delete connectors where deleted element is source', () => {
    const e1 = makeElement('e1');
    const e2 = makeElement('e2');
    const c1 = makeConnector('c1', 'e1', 'e2');
    useDiagramStore
      .getState()
      .setDiagram(makeDiagram({ elements: [e1, e2], connectors: [c1] }));
    useDiagramStore.getState().deleteElement('e1');
    expect(useDiagramStore.getState().diagram!.connectors).toEqual([]);
    expect(useDiagramStore.getState().diagram!.elements).toEqual([e2]);
  });

  it('should cascade-delete connectors where deleted element is target', () => {
    const e1 = makeElement('e1');
    const e2 = makeElement('e2');
    const c1 = makeConnector('c1', 'e2', 'e1');
    useDiagramStore
      .getState()
      .setDiagram(makeDiagram({ elements: [e1, e2], connectors: [c1] }));
    useDiagramStore.getState().deleteElement('e1');
    expect(useDiagramStore.getState().diagram!.connectors).toEqual([]);
  });

  it('should cascade-delete all connectors connected to deleted element', () => {
    const e1 = makeElement('e1');
    const e2 = makeElement('e2');
    const e3 = makeElement('e3');
    const c1 = makeConnector('c1', 'e1', 'e2'); // e1 is source
    const c2 = makeConnector('c2', 'e3', 'e1'); // e1 is target
    const c3 = makeConnector('c3', 'e2', 'e3'); // unrelated
    useDiagramStore.getState().setDiagram(
      makeDiagram({ elements: [e1, e2, e3], connectors: [c1, c2, c3] }),
    );
    useDiagramStore.getState().deleteElement('e1');
    expect(useDiagramStore.getState().diagram!.elements.map((e) => e.id)).toEqual(['e2', 'e3']);
    expect(useDiagramStore.getState().diagram!.connectors).toEqual([c3]);
  });

  it('should not affect connectors unrelated to deleted element', () => {
    const e1 = makeElement('e1');
    const e2 = makeElement('e2');
    const e3 = makeElement('e3');
    const c1 = makeConnector('c1', 'e2', 'e3');
    useDiagramStore.getState().setDiagram(
      makeDiagram({ elements: [e1, e2, e3], connectors: [c1] }),
    );
    useDiagramStore.getState().deleteElement('e1');
    expect(useDiagramStore.getState().diagram!.connectors).toEqual([c1]);
  });

  // --- addConnector ---

  it('should add a connector', () => {
    const e1 = makeElement('e1');
    const e2 = makeElement('e2');
    useDiagramStore.getState().setDiagram(makeDiagram({ elements: [e1, e2] }));
    const c = makeConnector('c1', 'e1', 'e2');
    useDiagramStore.getState().addConnector(c);
    expect(useDiagramStore.getState().diagram!.connectors).toEqual([c]);
  });

  it('should not crash when adding connector with no diagram', () => {
    useDiagramStore.getState().addConnector(makeConnector('c1', 'e1', 'e2'));
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  // --- deleteConnector ---

  it('should delete a connector by id', () => {
    const c1 = makeConnector('c1', 'e1', 'e2');
    const c2 = makeConnector('c2', 'e2', 'e3');
    useDiagramStore.getState().setDiagram(makeDiagram({ connectors: [c1, c2] }));
    useDiagramStore.getState().deleteConnector('c1');
    expect(useDiagramStore.getState().diagram!.connectors).toEqual([c2]);
  });

  // --- updateConnectorWaypoints ---

  it('should update connector waypoints', () => {
    const c1 = makeConnector('c1', 'e1', 'e2');
    useDiagramStore.getState().setDiagram(makeDiagram({ connectors: [c1] }));
    const waypoints: Position[] = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ];
    useDiagramStore.getState().updateConnectorWaypoints('c1', waypoints);
    expect(useDiagramStore.getState().diagram!.connectors[0].waypoints).toEqual(waypoints);
  });

  it('should not modify other connectors when updating waypoints', () => {
    const c1 = makeConnector('c1', 'e1', 'e2', { waypoints: [{ x: 1, y: 1 }] });
    const c2 = makeConnector('c2', 'e2', 'e3', { waypoints: [{ x: 5, y: 5 }] });
    useDiagramStore.getState().setDiagram(makeDiagram({ connectors: [c1, c2] }));
    useDiagramStore.getState().updateConnectorWaypoints('c1', [{ x: 99, y: 99 }]);
    expect(useDiagramStore.getState().diagram!.connectors[1].waypoints).toEqual([{ x: 5, y: 5 }]);
  });

  // --- reset ---

  it('should reset the store to null diagram', () => {
    useDiagramStore.getState().setDiagram(makeDiagram());
    useDiagramStore.getState().reset();
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  // --- No-op when diagram is null ---

  it('should no-op moveElement when diagram is null', () => {
    useDiagramStore.getState().moveElement('e1', { x: 1, y: 1 });
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  it('should no-op resizeElement when diagram is null', () => {
    useDiagramStore.getState().resizeElement('e1', { width: 1, height: 1 });
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  it('should no-op updateElementProperties when diagram is null', () => {
    useDiagramStore.getState().updateElementProperties('e1', { name: 'x' });
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  it('should no-op deleteElement when diagram is null', () => {
    useDiagramStore.getState().deleteElement('e1');
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  it('should no-op deleteConnector when diagram is null', () => {
    useDiagramStore.getState().deleteConnector('c1');
    expect(useDiagramStore.getState().diagram).toBeNull();
  });

  it('should no-op updateConnectorWaypoints when diagram is null', () => {
    useDiagramStore.getState().updateConnectorWaypoints('c1', []);
    expect(useDiagramStore.getState().diagram).toBeNull();
  });
});
