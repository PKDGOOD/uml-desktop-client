// =============================================================================
// Containment (A05.07): which element may own which, and the layout that goes
// with an ownership change. Pure functions over one diagram model.
// =============================================================================

import type { DiagramData, DiagramElement } from '../types';
import { PROJECT_LIMITS } from '../parser/project/projectFileLimits';

/**
 * Which element may own which (A03.05, `DiagramElement.parentId`): a composite
 * state owns states, pseudostates and composite states; a system boundary owns
 * use cases.
 */
export const CONTAINMENT: Partial<Record<string, readonly string[]>> = {
  'composite-state': ['state', 'initial-state', 'final-state', 'composite-state'],
  'system-boundary': ['usecase'],
};

export const canContain = (parentType: string, childType: string): boolean =>
  Object.prototype.hasOwnProperty.call(CONTAINMENT, parentType) && CONTAINMENT[parentType]!.includes(childType);

/** Whether any container kind can own this kind of element. */
export const canBeChild = (childType: string): boolean => Object.values(CONTAINMENT).some((kinds) => kinds?.includes(childType));

/** Every element below `id`, at any depth (a revisit stops the walk). */
export function descendantsOf(diagram: DiagramData, id: string): DiagramElement[] {
  const found: DiagramElement[] = [];
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const element of diagram.elements) {
      if (element.parentId === current && !seen.has(element.id)) {
        seen.add(element.id);
        found.push(element);
        queue.push(element.id);
      }
    }
  }
  return found;
}

/** Levels from the top to `id`: 0 for a top-level element. */
function depthOf(diagram: DiagramData, id: string): number {
  const byId = new Map(diagram.elements.map((element) => [element.id, element]));
  let depth = 0;
  const seen = new Set<string>([id]);
  for (let current = byId.get(id); current?.parentId !== undefined; ) {
    const parent = byId.get(current.parentId);
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    depth += 1;
    current = parent;
  }
  return depth;
}

/** Height of the subtree below `id`: 0 for a leaf. */
function subtreeHeight(diagram: DiagramData, id: string, seen = new Set<string>()): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  const children = diagram.elements.filter((element) => element.parentId === id);
  return children.length === 0 ? 0 : 1 + Math.max(...children.map((child) => subtreeHeight(diagram, child.id, seen)));
}

/** Deepest allowed nesting (matches the file format; see `MAX_CONTAINMENT_DEPTH` in diagramRules). */
const MAX_DEPTH = 8;

/**
 * Why `id` cannot be given `parentId` as its parent (null: top level), or null
 * when the edit is fine. Names the elements so the text can be shown as is.
 */
export function reparentProblem(diagram: DiagramData, id: string, parentId: string | null): string | null {
  const element = diagram.elements.find((candidate) => candidate.id === id);
  if (!element) return 'That element no longer exists.';
  if (parentId === null) return null;
  const parent = diagram.elements.find((candidate) => candidate.id === parentId);
  if (!parent) return 'That parent no longer exists.';
  const name = (e: DiagramElement) => `"${e.properties.name}"`;
  if (parent.id === element.id) return `${name(element)} cannot contain itself.`;
  if (descendantsOf(diagram, element.id).some((below) => below.id === parent.id)) {
    return `${name(parent)} is inside ${name(element)}; moving ${name(element)} into it would make a loop.`;
  }
  if (!canContain(parent.type, element.type)) return `A ${parent.type} cannot contain a ${element.type} (${name(element)}).`;
  if (depthOf(diagram, parent.id) + 1 + subtreeHeight(diagram, element.id) > MAX_DEPTH) {
    return `${name(element)} would be nested more than ${MAX_DEPTH} levels deep.`;
  }
  return null;
}

/**
 * Elements that may own `id` right now, for the Parent choices (never itself or anything below it).
 * The subtree and depths are worked out once, so a diagram near the element limit stays fast.
 */
export function parentCandidates(diagram: DiagramData, id: string): DiagramElement[] {
  const element = diagram.elements.find((candidate) => candidate.id === id);
  if (!element) return [];
  const below = new Set(descendantsOf(diagram, id).map((e) => e.id));
  const height = subtreeHeight(diagram, id);
  const byId = new Map(diagram.elements.map((e) => [e.id, e]));
  const depths = new Map<string, number>();
  const depth = (target: DiagramElement): number => {
    const known = depths.get(target.id);
    if (known !== undefined) return known;
    depths.set(target.id, 0); // a cycle in bad data ends here
    const parent = target.parentId === undefined ? undefined : byId.get(target.parentId);
    const value = parent ? depth(parent) + 1 : 0;
    depths.set(target.id, value);
    return value;
  };
  return diagram.elements.filter((candidate) => candidate.id !== id && !below.has(candidate.id)
    && canContain(candidate.type, element.type) && depth(candidate) + 1 + height <= MAX_DEPTH);
}

const PADDING = 16;
const GAP = 24;

const shift = (elements: DiagramElement[], dx: number, dy: number): void => {
  for (const element of elements) element.position = { x: element.position.x + dx, y: element.position.y + dy };
};

/**
 * Change the owner of `id` and lay the result out together (mutates `diagram`):
 * - into a container: the element moves inside its bounds and the container (and
 *   its own containers) grow when the element does not fit;
 * - to the top level: an element still lying inside its old container is placed
 *   just to the right of it.
 * Everything below the element moves by the same amount, so the subtree keeps its shape.
 */
export function applyReparent(diagram: DiagramData, id: string, parentId: string | null): void {
  const element = diagram.elements.find((candidate) => candidate.id === id);
  if (!element) return;
  const oldParent = diagram.elements.find((candidate) => candidate.id === element.parentId);
  const below = descendantsOf(diagram, id);
  const from = { ...element.position };

  if (parentId === null) {
    delete element.parentId;
    if (oldParent) {
      const inside = element.position.x < oldParent.position.x + oldParent.size.width
        && element.position.x + element.size.width > oldParent.position.x
        && element.position.y < oldParent.position.y + oldParent.size.height
        && element.position.y + element.size.height > oldParent.position.y;
      if (inside) element.position = { x: oldParent.position.x + oldParent.size.width + GAP, y: element.position.y };
    }
  } else {
    const parent = diagram.elements.find((candidate) => candidate.id === parentId);
    if (!parent) return;
    element.parentId = parentId;
    parent.size = {
      width: Math.max(parent.size.width, element.size.width + 2 * PADDING),
      height: Math.max(parent.size.height, element.size.height + 2 * PADDING),
    };
    element.position = {
      x: Math.min(Math.max(element.position.x, parent.position.x + PADDING), parent.position.x + parent.size.width - PADDING - element.size.width),
      y: Math.min(Math.max(element.position.y, parent.position.y + PADDING), parent.position.y + parent.size.height - PADDING - element.size.height),
    };
    // Each container up the chain must still hold the one below it.
    const byId = new Map(diagram.elements.map((candidate) => [candidate.id, candidate]));
    const seen = new Set<string>([id]);
    for (let child: DiagramElement = parent; child.parentId !== undefined; ) {
      const owner = byId.get(child.parentId);
      if (!owner || seen.has(owner.id)) break;
      seen.add(owner.id);
      const left = Math.min(owner.position.x, child.position.x - PADDING);
      const top = Math.min(owner.position.y, child.position.y - PADDING);
      const right = Math.max(owner.position.x + owner.size.width, child.position.x + child.size.width + PADDING);
      const bottom = Math.max(owner.position.y + owner.size.height, child.position.y + child.size.height + PADDING);
      owner.position = { x: left, y: top };
      owner.size = { width: right - left, height: bottom - top };
      child = owner;
    }
  }
  shift(below, element.position.x - from.x, element.position.y - from.y);
  // Canvas draws in array order: the element and what it owns go last so an opaque owner never hides them.
  const moved = new Set([id, ...below.map((e) => e.id)]);
  diagram.elements = [...diagram.elements.filter((e) => !moved.has(e.id)), ...diagram.elements.filter((e) => moved.has(e.id))];
}

/**
 * Why the elements that `before` and `after` differ on have unusable geometry (A05.07, A05.09), or null:
 * a position or size that is not a finite number, a position outside the project's coordinate range,
 * or a size that is not positive or exceeds the allowed extent. Untouched elements are not judged.
 */
export function coordinateProblem(after: DiagramData, before?: DiagramData): string | null {
  const limit = PROJECT_LIMITS.coordinate;
  const old = new Map((before?.elements ?? []).map((e) => [e.id, e]));
  for (const e of after.elements) {
    const was = old.get(e.id);
    if (was && was.position.x === e.position.x && was.position.y === e.position.y
      && was.size.width === e.size.width && was.size.height === e.size.height) continue;
    const numbers = [e.position.x, e.position.y, e.size.width, e.size.height];
    const name = `"${e.properties.name}"`;
    if (!numbers.every(Number.isFinite)) return `${name} would get a position or size that is not a number.`;
    if (Math.abs(e.position.x) > limit || Math.abs(e.position.y) > limit) return `${name} would end up outside the allowed canvas area.`;
    if (e.size.width <= 0 || e.size.height <= 0) return `${name} needs a width and height above zero.`;
    if (e.size.width > PROJECT_LIMITS.extent || e.size.height > PROJECT_LIMITS.extent) return `${name} would be larger than the allowed ${PROJECT_LIMITS.extent} units.`;
  }
  return null;
}

/** The selected elements that no other selected element owns; those ride along when their owner moves (A05.08). */
export function withoutSelectedOwners(elements: DiagramElement[], selected: DiagramElement[]): DiagramElement[] {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const ids = new Set(selected.map((element) => element.id));
  return selected.filter((element) => {
    const seen = new Set<string>([element.id]);
    for (let parent = element.parentId === undefined ? undefined : byId.get(element.parentId); parent && !seen.has(parent.id); parent = parent.parentId === undefined ? undefined : byId.get(parent.parentId)) {
      if (ids.has(parent.id)) return false;
      seen.add(parent.id);
    }
    return true;
  });
}

/** What deleting some elements takes with it (A05.10). */
export interface DeletionImpact {
  /** Elements that go because they sit inside a deleted one, not because they were chosen. */
  owned: DiagramElement[];
  /** Connections that end at any element that goes. */
  connectors: DiagramData['connectors'];
}

export function deletionImpact(diagram: DiagramData, ids: readonly string[]): DeletionImpact {
  const chosen = new Set(ids);
  const gone = new Set(chosen);
  const owned: DiagramElement[] = [];
  for (const id of chosen) {
    for (const below of descendantsOf(diagram, id)) {
      if (!gone.has(below.id)) { gone.add(below.id); owned.push(below); }
    }
  }
  return { owned, connectors: diagram.connectors.filter((c) => gone.has(c.sourceId) || gone.has(c.targetId)) };
}

/** The question shown before deleting a container, or null when only the chosen leaves go. */
export function deletionPrompt(diagram: DiagramData, ids: readonly string[]): string | null {
  const { owned, connectors } = deletionImpact(diagram, ids);
  if (owned.length === 0) return null;
  const names = (list: DiagramElement[]) => list.slice(0, 8).map((e) => `"${e.properties.name}"`).join(', ') + (list.length > 8 ? `, and ${list.length - 8} more` : '');
  const chosen = diagram.elements.filter((e) => ids.includes(e.id));
  return `Delete ${names(chosen)} together with ${owned.length} element${owned.length === 1 ? '' : 's'} inside (${names(owned)})`
    + ` and ${connectors.length} connection${connectors.length === 1 ? '' : 's'}? You can undo this.`;
}
