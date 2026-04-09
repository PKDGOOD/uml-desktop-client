// =============================================================================
// ConnectorRenderer - Renders Connector lines/arrows between elements
// =============================================================================

import React from 'react';
import { Group, Line, Arrow, Text, Circle } from 'react-konva';
import type { Connector, DiagramElement, Position, ConnectorType } from '../../types';

export interface ConnectorRendererProps {
  connector: Connector;
  elements: DiagramElement[];
  isSelected: boolean;
  onSelect: (connectorId: string, shiftKey: boolean) => void;
  onWaypointDragEnd: (connectorId: string, waypoints: Position[]) => void;
}

/** Get center point of an element */
function getElementCenter(el: DiagramElement): Position {
  return {
    x: el.position.x + el.size.width / 2,
    y: el.position.y + el.size.height / 2,
  };
}

/** Get the intersection point of a line from center to target on the element's bounding box */
function getEdgePoint(el: DiagramElement, target: Position): Position {
  const center = getElementCenter(el);
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (dx === 0 && dy === 0) return center;

  const hw = el.size.width / 2;
  const hh = el.size.height / 2;

  // Scale factor to reach the edge
  const scaleX = hw / Math.abs(dx || 1);
  const scaleY = hh / Math.abs(dy || 1);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function getLineStyle(type: ConnectorType): { dash?: number[]; strokeWidth: number } {
  switch (type) {
    case 'dependency':
    case 'usage':
    case 'realization':
    case 'include':
    case 'extend':
    case 'return-message':
    case 'async-message':
      return { dash: [8, 4], strokeWidth: 1.5 };
    default:
      return { strokeWidth: 1.5 };
  }
}

function getArrowFill(type: ConnectorType): string | undefined {
  switch (type) {
    case 'composition':
      return '#333333';
    case 'aggregation':
      return '#FFFFFF';
    case 'inheritance':
    case 'realization':
      return '#FFFFFF';
    default:
      return undefined;
  }
}

function needsArrow(type: ConnectorType): boolean {
  return type !== 'association';
}

function getArrowPointerLength(type: ConnectorType): number {
  switch (type) {
    case 'aggregation':
    case 'composition':
      return 12;
    case 'inheritance':
    case 'realization':
      return 14;
    default:
      return 10;
  }
}

const SELECTED_COLOR = '#1976D2';
const DEFAULT_COLOR = '#333333';
const WAYPOINT_RADIUS = 4;

export const ConnectorRenderer: React.FC<ConnectorRendererProps> = ({
  connector,
  elements,
  isSelected,
  onSelect,
  onWaypointDragEnd,
}) => {
  const sourceEl = elements.find((e) => e.id === connector.sourceId);
  const targetEl = elements.find((e) => e.id === connector.targetId);

  if (!sourceEl || !targetEl) return null;

  const waypoints = connector.waypoints ?? [];
  const color = isSelected ? SELECTED_COLOR : DEFAULT_COLOR;
  const lineStyle = getLineStyle(connector.type);

  // Build full point list: source edge → waypoints → target edge
  const firstTarget = waypoints.length > 0 ? waypoints[0] : getElementCenter(targetEl);
  const lastSource = waypoints.length > 0 ? waypoints[waypoints.length - 1] : getElementCenter(sourceEl);

  const sourcePoint = getEdgePoint(sourceEl, firstTarget);
  const targetPoint = getEdgePoint(targetEl, lastSource);

  const allPoints: number[] = [sourcePoint.x, sourcePoint.y];
  for (const wp of waypoints) {
    allPoints.push(wp.x, wp.y);
  }
  allPoints.push(targetPoint.x, targetPoint.y);

  const handleClick = (e: any) => {
    e.cancelBubble = true;
    onSelect(connector.id, e.evt.shiftKey);
  };

  // Waypoint drag handlers
  const handleWaypointDragEnd = (index: number, e: any) => {
    const newWaypoints = [...waypoints];
    newWaypoints[index] = { x: e.target.x(), y: e.target.y() };
    onWaypointDragEnd(connector.id, newWaypoints);
  };

  // Label position: midpoint of the line
  const midIdx = Math.floor(allPoints.length / 4) * 2;
  const labelX = (allPoints[midIdx] + allPoints[midIdx + 2]) / 2;
  const labelY = (allPoints[midIdx + 1] + allPoints[midIdx + 3]) / 2;

  return (
    <Group onClick={handleClick} onTap={handleClick}>
      {needsArrow(connector.type) ? (
        <Arrow
          points={allPoints}
          stroke={color}
          strokeWidth={lineStyle.strokeWidth}
          dash={lineStyle.dash}
          fill={getArrowFill(connector.type) ?? color}
          pointerLength={getArrowPointerLength(connector.type)}
          pointerWidth={8}
          hitStrokeWidth={12}
        />
      ) : (
        <Line
          points={allPoints}
          stroke={color}
          strokeWidth={lineStyle.strokeWidth}
          dash={lineStyle.dash}
          hitStrokeWidth={12}
        />
      )}

      {/* Label */}
      {connector.label && (
        <Text
          x={labelX - 30}
          y={labelY - 18}
          text={connector.label}
          fontSize={11}
          fill="#555"
          width={60}
          align="center"
        />
      )}

      {/* Source multiplicity */}
      {connector.sourceMultiplicity && (
        <Text
          x={sourcePoint.x + 4}
          y={sourcePoint.y - 16}
          text={connector.sourceMultiplicity}
          fontSize={10}
          fill="#666"
        />
      )}

      {/* Target multiplicity */}
      {connector.targetMultiplicity && (
        <Text
          x={targetPoint.x + 4}
          y={targetPoint.y - 16}
          text={connector.targetMultiplicity}
          fontSize={10}
          fill="#666"
        />
      )}

      {/* Draggable waypoints (visible when selected) */}
      {isSelected &&
        waypoints.map((wp, i) => (
          <Circle
            key={`wp-${connector.id}-${i}`}
            x={wp.x}
            y={wp.y}
            radius={WAYPOINT_RADIUS}
            fill={SELECTED_COLOR}
            stroke="#0D47A1"
            strokeWidth={1}
            draggable
            onDragEnd={(e) => handleWaypointDragEnd(i, e)}
          />
        ))}
    </Group>
  );
};
