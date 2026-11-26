// =============================================================================
// Geometry of canvas gestures (A05.09)
// =============================================================================

import type { DiagramData, Position, Size } from '../types';
import { PROJECT_LIMITS } from '../parser/project/projectFileLimits';
import type { DiagramRuleError } from './diagramRules';

/** The smallest box the resize handle can make. */
export const MIN_SIZE: Size = { width: 40, height: 30 };

/** Keep a dragged size between the handle minimum and the file format's ceiling. */
export function clampSize(size: Size): Size {
  const clamp = (value: number, min: number) => Math.min(Math.max(Number.isFinite(value) ? value : min, min), PROJECT_LIMITS.extent);
  return { width: clamp(size.width, MIN_SIZE.width), height: clamp(size.height, MIN_SIZE.height) };
}

/**
 * The value a finished drag or resize gesture commits, or null when it commits
 * nothing: the gesture was cancelled, or it ended where it started.
 */
export function gestureResult<T extends Position | Size>(before: T, after: T, cancelled: boolean): T | null {
  if (cancelled) return null;
  const same = Object.keys(before).every((key) => before[key as keyof T] === after[key as keyof T]);
  return same ? null : after;
}

/** Positions and sizes a saved file could not hold (the A03.01 ceilings), so a command must not create them. */
export function validateGeometry(diagram: DiagramData): DiagramRuleError[] {
  const errors: DiagramRuleError[] = [];
  const coordinate = (value: number) => Number.isFinite(value) && Math.abs(value) <= PROJECT_LIMITS.coordinate;
  const extent = (value: number) => Number.isFinite(value) && value > 0 && value <= PROJECT_LIMITS.extent;
  diagram.elements.forEach((element, i) => {
    const name = JSON.stringify(element.properties.name);
    if (!coordinate(element.position.x) || !coordinate(element.position.y)) {
      errors.push({ message: `${name} would move outside ±${PROJECT_LIMITS.coordinate.toLocaleString('en-US')}`, path: `elements[${i}].position` });
    }
    if (!extent(element.size.width) || !extent(element.size.height)) {
      errors.push({ message: `${name} must be larger than 0 and at most ${PROJECT_LIMITS.extent.toLocaleString('en-US')} wide and high`, path: `elements[${i}].size` });
    }
  });
  return errors;
}
