// =============================================================================
// Containment helpers - explicit parents, descendants and reparenting (A05.07)
// =============================================================================

import type { CanvasChange, Connector, DiagramData, DiagramElement, Position } from '../types';
import { canContain } from './diagramRules';

/** IDs of every element below `id`, at any depth. A cycle in a bad model stops the walk. */
export function descendantIds(diagram: DiagramData, id: string): Set<string> {
  const result = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const element of diagram.elements) {
      if (element.parentId === current && element.id !== id && !result.has(element.id)) {
        result.add(element.id);
        queue.push(element.id);
      }
    }
  }
  return result;
}

/** Elements that may become the parent of `id`: the right kind, and neither the element nor one of its descendants. */
export function parentCandidates(diagram: DiagramData, id: string): DiagramElement[] {
  const element = diagram.elements.find((candidate) => candidate.id === id);
  if (!element) return [];
  const below = descendantIds(diagram, id);
  return diagram.elements.filter((candidate) => candidate.id !== id && !below.has(candidate.id) && canContain(candidate.type, element.type));
}

/** Why `id` cannot be put under `parentId` (undefined = top level), or null when it can. */
export function reparentProblem(diagram: DiagramData, id: string, parentId: string | undefined): string | null {
  const element = diagram.elements.find((candidate) => candidate.id === id);
  if (!element) return `Element ${id} does not exist`;
  if (parentId === undefined) return null;
  const parent = diagram.elements.find((candidate) => candidate.id === parentId);
  if (!parent) return `Element ${parentId} does not exist`;
  const name = JSON.stringify(element.properties.name);
  if (parent.id === id || descendantIds(diagram, id).has(parent.id)) return `${name} cannot be placed inside itself`;
  if (!canContain(parent.type, element.type)) return `A ${parent.type} cannot contain a ${element.type}`;
  return null;
}

const INSET: Position = { x: 20, y: 40 };
const GAP = 40;

/**
 * The command that moves `id` (and everything inside it) under `parentId`, laying
 * it out together with the ownership change: an element already inside the new
 * parent's bounds stays where it is; one that enters a parent moves to its inner
 * top-left corner; one that leaves for the top level moves just right of its
 * outermost old container, so it no longer looks nested.
 */
export function reparentChange(diagram: DiagramData, id: string, parentId: string | undefined): CanvasChange {
  const byId = new Map(diagram.elements.map((element) => [element.id, element]));
  const element = byId.get(id)!;
  let position = element.position;
  if (parentId !== undefined) {
    const parent = byId.get(parentId)!;
    if (!inside(element, parent)) position = { x: parent.position.x + INSET.x, y: parent.position.y + INSET.y };
  } else if (element.parentId !== undefined) {
    let outermost = element;
    while (outermost.parentId !== undefined && byId.has(outermost.parentId)) outermost = byId.get(outermost.parentId)!;
    position = { x: outermost.position.x + outermost.size.width + GAP, y: element.position.y };
  }
  return parentId === undefined
    ? { type: 'element-reparent', elementId: id, position: { ...position } }
    : { type: 'element-reparent', elementId: id, parentId, position: { ...position } };
}

function inside(element: DiagramElement, container: DiagramElement): boolean {
  return element.position.x >= container.position.x
    && element.position.y >= container.position.y
    && element.position.x + element.size.width <= container.position.x + container.size.width
    && element.position.y + element.size.height <= container.position.y + container.size.height;
}

/**
 * Moving an element to `position` as one canvas gesture (A05.08): everything
 * inside it moves by the same delta, in one command. Ownership never changes
 * here, even when the element ends up outside its parent's border.
 */
export function moveWithDescendants(diagram: DiagramData, id: string, position: Position): CanvasChange {
  const element = diagram.elements.find((candidate) => candidate.id === id);
  const below = descendantIds(diagram, id);
  if (!element || below.size === 0) return { type: 'element-move', elementId: id, position: { ...position } };
  const dx = position.x - element.position.x;
  const dy = position.y - element.position.y;
  return {
    type: 'batch',
    changes: [
      { type: 'element-move', elementId: id, position: { ...position } },
      ...diagram.elements
        .filter((item) => below.has(item.id))
        .map((item): CanvasChange => ({ type: 'element-move', elementId: item.id, position: { x: item.position.x + dx, y: item.position.y + dy } })),
    ],
  };
}

/** Remove an element, everything inside it and every link touching any of them (A05.10). Mutates `diagram`. */
export function deleteSubtree(diagram: DiagramData, id: string): void {
  const removed = descendantIds(diagram, id).add(id);
  diagram.elements = diagram.elements.filter((element) => !removed.has(element.id));
  diagram.connectors = diagram.connectors.filter((connector) => !removed.has(connector.sourceId) && !removed.has(connector.targetId));
}

export interface DeleteImpact {
  /** Elements that go because they are inside a selected container, not because they were selected. */
  inside: DiagramElement[];
  /** Every connection that goes: selected ones and those touching a removed element. */
  connectors: Connector[];
}

/** What deleting the selection takes with it, so a container delete can be confirmed first. */
export function deleteImpact(diagram: DiagramData, elementIds: Iterable<string>, connectorIds: Iterable<string> = []): DeleteImpact {
  const selected = new Set(elementIds);
  const removed = new Set(selected);
  for (const id of selected) for (const below of descendantIds(diagram, id)) removed.add(below);
  const links = new Set(connectorIds);
  return {
    inside: diagram.elements.filter((element) => removed.has(element.id) && !selected.has(element.id)),
    connectors: diagram.connectors.filter((connector) => links.has(connector.id) || removed.has(connector.sourceId) || removed.has(connector.targetId)),
  };
}

/** The confirmation question for a delete that takes contents along, or null when nothing extra goes. */
export function deleteConfirmation(diagram: DiagramData, elementIds: Iterable<string>, connectorIds: Iterable<string> = []): string | null {
  const ids = [...elementIds];
  const { inside, connectors } = deleteImpact(diagram, ids, connectorIds);
  if (inside.length === 0) return null;
  const names = (list: DiagramElement[]) => list.map((element) => JSON.stringify(element.properties.name)).join(', ');
  const containers = diagram.elements.filter((element) => ids.includes(element.id));
  const links = connectors.length === 0 ? '' : ` and ${connectors.length} connection${connectors.length === 1 ? '' : 's'}`;
  return `Delete ${names(containers)} with ${inside.length} element${inside.length === 1 ? '' : 's'} inside (${names(inside)})${links}? Undo restores them.`;
}
