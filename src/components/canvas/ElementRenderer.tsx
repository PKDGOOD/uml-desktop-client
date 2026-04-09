// =============================================================================
// ElementRenderer - Renders DiagramElement shapes on Konva canvas
// =============================================================================

import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text, Circle, Ellipse, Line } from 'react-konva';
import type { DiagramElement, Position, Size, CanvasChange } from '../../types';

export interface ElementRendererProps {
  element: DiagramElement;
  isSelected: boolean;
  onSelect: (elementId: string, shiftKey: boolean) => void;
  onDragEnd: (elementId: string, position: Position) => void;
  onResize: (elementId: string, size: Size, position: Position) => void;
  onDoubleClick: (elementId: string) => void;
}

const COLORS = {
  class: { fill: '#FFFDE7', stroke: '#F9A825' },
  interface: { fill: '#E3F2FD', stroke: '#1565C0' },
  'abstract-class': { fill: '#FFF3E0', stroke: '#E65100' },
  enum: { fill: '#F3E5F5', stroke: '#7B1FA2' },
  actor: { fill: '#E8F5E9', stroke: '#2E7D32' },
  usecase: { fill: '#E0F7FA', stroke: '#00838F' },
  'system-boundary': { fill: '#FAFAFA', stroke: '#616161' },
  state: { fill: '#FCE4EC', stroke: '#C62828' },
  'initial-state': { fill: '#212121', stroke: '#212121' },
  'final-state': { fill: '#212121', stroke: '#212121' },
  'composite-state': { fill: '#FFEBEE', stroke: '#B71C1C' },
  action: { fill: '#E8EAF6', stroke: '#283593' },
  decision: { fill: '#FFF8E1', stroke: '#FF8F00' },
  fork: { fill: '#212121', stroke: '#212121' },
  join: { fill: '#212121', stroke: '#212121' },
  'initial-node': { fill: '#212121', stroke: '#212121' },
  'final-node': { fill: '#212121', stroke: '#212121' },
  lifeline: { fill: '#F1F8E9', stroke: '#558B2F' },
  activation: { fill: '#FFFFFF', stroke: '#9E9E9E' },
  message: { fill: '#FFFFFF', stroke: '#9E9E9E' },
  note: { fill: '#FFFDE7', stroke: '#FBC02D' },
  package: { fill: '#ECEFF1', stroke: '#455A64' },
};

const SELECTED_STROKE = '#1976D2';
const HANDLE_SIZE = 8;

export const ElementRenderer: React.FC<ElementRendererProps> = ({
  element,
  isSelected,
  onSelect,
  onDragEnd,
  onResize,
  onDoubleClick,
}) => {
  const { id, type, position, size, properties } = element;
  const colors = COLORS[type] ?? { fill: '#FFFFFF', stroke: '#333333' };
  const stroke = isSelected ? SELECTED_STROKE : colors.stroke;

  const handleDragEnd = (e: any) => {
    onDragEnd(id, { x: e.target.x(), y: e.target.y() });
  };

  const handleClick = (e: any) => {
    onSelect(id, e.evt.shiftKey);
  };

  const handleDblClick = () => {
    onDoubleClick(id);
  };

  // Resize handle drag
  const handleResizeDrag = (e: any) => {
    const node = e.target;
    const newWidth = Math.max(40, node.x() + HANDLE_SIZE);
    const newHeight = Math.max(30, node.y() + HANDLE_SIZE);
    // Reset handle position to bottom-right of new size
    node.x(newWidth - HANDLE_SIZE);
    node.y(newHeight - HANDLE_SIZE);
  };

  const handleResizeDragEnd = (e: any) => {
    const node = e.target;
    const group = node.getParent();
    const newWidth = Math.max(40, node.x() + HANDLE_SIZE);
    const newHeight = Math.max(30, node.y() + HANDLE_SIZE);
    onResize(id, { width: newWidth, height: newHeight }, { x: group.x(), y: group.y() });
  };

  const renderShape = () => {
    switch (type) {
      case 'actor':
        return <ActorShape size={size} colors={colors} stroke={stroke} />;
      case 'initial-state':
      case 'initial-node':
        return <InitialNodeShape size={size} />;
      case 'final-state':
      case 'final-node':
        return <FinalNodeShape size={size} />;
      case 'decision':
        return <DiamondShape size={size} colors={colors} stroke={stroke} />;
      case 'fork':
      case 'join':
        return <BarShape size={size} />;
      case 'usecase':
        return <EllipseShape size={size} colors={colors} stroke={stroke} name={properties.name} />;
      default:
        return <RectShape size={size} colors={colors} stroke={stroke} element={element} />;
    }
  };

  return (
    <Group
      x={position.x}
      y={position.y}
      draggable
      onClick={handleClick}
      onTap={handleClick}
      onDblClick={handleDblClick}
      onDblTap={handleDblClick}
      onDragEnd={handleDragEnd}
    >
      {renderShape()}
      {isSelected && (
        <ResizeHandles
          size={size}
          onDrag={handleResizeDrag}
          onDragEnd={handleResizeDragEnd}
        />
      )}
    </Group>
  );
};


// =============================================================================
// Sub-shapes
// =============================================================================

interface ShapeColors {
  fill: string;
  stroke: string;
}

const RectShape: React.FC<{
  size: Size;
  colors: ShapeColors;
  stroke: string;
  element: DiagramElement;
}> = ({ size, colors, stroke, element }) => {
  const { properties, type } = element;
  const hasCompartments = type === 'class' || type === 'interface' || type === 'abstract-class' || type === 'enum';

  // Build label lines
  const headerLines: string[] = [];
  if (properties.stereotype) headerLines.push(`«${properties.stereotype}»`);
  if (type === 'interface') headerLines.push('«interface»');
  headerLines.push(properties.name);

  const headerText = headerLines.join('\n');
  const headerHeight = hasCompartments ? Math.max(36, headerLines.length * 16 + 8) : size.height;

  return (
    <>
      <Rect
        width={size.width}
        height={size.height}
        fill={colors.fill}
        stroke={stroke}
        strokeWidth={type === 'abstract-class' ? 2 : 1}
        cornerRadius={type === 'state' || type === 'composite-state' || type === 'action' ? 8 : 0}
      />
      <Text
        text={headerText}
        width={size.width}
        height={headerHeight}
        align="center"
        verticalAlign="middle"
        fontSize={12}
        fontStyle={type === 'abstract-class' ? 'italic bold' : 'bold'}
        padding={4}
      />
      {hasCompartments && (
        <>
          {/* Separator line */}
          <Line
            points={[0, headerHeight, size.width, headerHeight]}
            stroke={stroke}
            strokeWidth={1}
          />
          {/* Attributes */}
          <Text
            y={headerHeight + 2}
            text={formatAttributes(properties.attributes)}
            width={size.width}
            fontSize={11}
            padding={4}
          />
          {/* Methods separator */}
          <Line
            points={[0, headerHeight + Math.max(20, (properties.attributes?.length ?? 0) * 14 + 6), size.width, headerHeight + Math.max(20, (properties.attributes?.length ?? 0) * 14 + 6)]}
            stroke={stroke}
            strokeWidth={1}
          />
          {/* Methods */}
          <Text
            y={headerHeight + Math.max(20, (properties.attributes?.length ?? 0) * 14 + 6) + 2}
            text={formatMethods(properties.methods)}
            width={size.width}
            fontSize={11}
            padding={4}
          />
        </>
      )}
    </>
  );
};

const ActorShape: React.FC<{ size: Size; colors: ShapeColors; stroke: string }> = ({
  size,
  colors,
  stroke,
}) => {
  const cx = size.width / 2;
  const headR = Math.min(size.width, size.height) * 0.15;
  const bodyTop = headR * 2 + 4;
  const bodyBottom = size.height * 0.65;
  const armY = bodyTop + (bodyBottom - bodyTop) * 0.3;

  return (
    <>
      {/* Head */}
      <Circle x={cx} y={headR + 2} radius={headR} fill={colors.fill} stroke={stroke} strokeWidth={1} />
      {/* Body */}
      <Line points={[cx, bodyTop, cx, bodyBottom]} stroke={stroke} strokeWidth={1} />
      {/* Arms */}
      <Line points={[cx - size.width * 0.3, armY, cx + size.width * 0.3, armY]} stroke={stroke} strokeWidth={1} />
      {/* Legs */}
      <Line points={[cx, bodyBottom, cx - size.width * 0.25, size.height - 2]} stroke={stroke} strokeWidth={1} />
      <Line points={[cx, bodyBottom, cx + size.width * 0.25, size.height - 2]} stroke={stroke} strokeWidth={1} />
    </>
  );
};

const InitialNodeShape: React.FC<{ size: Size }> = ({ size }) => (
  <Circle
    x={size.width / 2}
    y={size.height / 2}
    radius={Math.min(size.width, size.height) / 2}
    fill="#212121"
  />
);

const FinalNodeShape: React.FC<{ size: Size }> = ({ size }) => {
  const r = Math.min(size.width, size.height) / 2;
  return (
    <>
      <Circle x={size.width / 2} y={size.height / 2} radius={r} stroke="#212121" strokeWidth={2} fill="white" />
      <Circle x={size.width / 2} y={size.height / 2} radius={r * 0.6} fill="#212121" />
    </>
  );
};

const DiamondShape: React.FC<{ size: Size; colors: ShapeColors; stroke: string }> = ({
  size,
  colors,
  stroke,
}) => {
  const cx = size.width / 2;
  const cy = size.height / 2;
  return (
    <Line
      points={[cx, 0, size.width, cy, cx, size.height, 0, cy]}
      closed
      fill={colors.fill}
      stroke={stroke}
      strokeWidth={1}
    />
  );
};

const BarShape: React.FC<{ size: Size }> = ({ size }) => (
  <Rect width={size.width} height={Math.min(size.height, 6)} fill="#212121" y={(size.height - 6) / 2} />
);

const EllipseShape: React.FC<{
  size: Size;
  colors: ShapeColors;
  stroke: string;
  name: string;
}> = ({ size, colors, stroke, name }) => (
  <>
    <Ellipse
      x={size.width / 2}
      y={size.height / 2}
      radiusX={size.width / 2}
      radiusY={size.height / 2}
      fill={colors.fill}
      stroke={stroke}
      strokeWidth={1}
    />
    <Text
      text={name}
      width={size.width}
      height={size.height}
      align="center"
      verticalAlign="middle"
      fontSize={12}
    />
  </>
);

// =============================================================================
// Resize handles (corner)
// =============================================================================

const ResizeHandles: React.FC<{
  size: Size;
  onDrag: (e: any) => void;
  onDragEnd: (e: any) => void;
}> = ({ size, onDrag, onDragEnd }) => (
  <Rect
    x={size.width - HANDLE_SIZE}
    y={size.height - HANDLE_SIZE}
    width={HANDLE_SIZE}
    height={HANDLE_SIZE}
    fill="#1976D2"
    stroke="#0D47A1"
    strokeWidth={1}
    draggable
    onDragMove={onDrag}
    onDragEnd={onDragEnd}
    cursor="nwse-resize"
  />
);

// =============================================================================
// Formatting helpers
// =============================================================================

function visibilityPrefix(v?: string): string {
  switch (v) {
    case 'public': return '+';
    case 'private': return '-';
    case 'protected': return '#';
    case 'package': return '~';
    default: return '';
  }
}

function formatAttributes(attrs?: { name: string; type: string; visibility: string }[]): string {
  if (!attrs || attrs.length === 0) return '';
  return attrs.map((a) => `${visibilityPrefix(a.visibility)} ${a.name}: ${a.type}`).join('\n');
}

function formatMethods(methods?: { name: string; returnType: string; parameters: { name: string; type: string }[]; visibility: string }[]): string {
  if (!methods || methods.length === 0) return '';
  return methods
    .map((m) => {
      const params = m.parameters.map((p) => `${p.name}: ${p.type}`).join(', ');
      return `${visibilityPrefix(m.visibility)} ${m.name}(${params}): ${m.returnType}`;
    })
    .join('\n');
}
