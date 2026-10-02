import type { Connector, DiagramElement, Position } from '../types';

function center(element: DiagramElement): Position {
  return { x: element.position.x + element.size.width / 2, y: element.position.y + element.size.height / 2 };
}
function edge(element: DiagramElement, toward: Position): Position {
  const point = center(element);
  const dx = toward.x - point.x, dy = toward.y - point.y;
  if (!dx && !dy) return point;
  const scale = Math.min(dx ? element.size.width / 2 / Math.abs(dx) : Infinity,
    dy ? element.size.height / 2 / Math.abs(dy) : Infinity);
  return { x: point.x + dx * scale, y: point.y + dy * scale };
}

export function connectorGeometry(connector: Connector, elements: DiagramElement[], sequenceIndex?: number) {
  const source = elements.find((element) => element.id === connector.sourceId);
  const target = elements.find((element) => element.id === connector.targetId);
  if (!source || !target) return null;
  if (sequenceIndex !== undefined) {
    const y = Math.max(source.position.y, target.position.y) + 65 + sequenceIndex * 32;
    return { source: { x: center(source).x, y }, target: { x: center(target).x, y }, waypoints: [] as Position[] };
  }
  const waypoints = connector.waypoints ?? [];
  return {
    source: edge(source, waypoints[0] ?? center(target)),
    target: edge(target, waypoints[waypoints.length - 1] ?? center(source)), waypoints,
  };
}
