// =============================================================================
// Containment helpers - explicit parents, descendants and reparenting (A05.07)
// =============================================================================

import type { CanvasChange, DiagramData, DiagramElement, Position } from '../types';
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
