// =============================================================================
// UMLCanvas - Main canvas component with Konva Stage
// =============================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Line } from 'react-konva';
import { useDiagramStore } from '../../store/diagramStore';
import { useCanvasControls } from './useCanvasControls';
import { ElementRenderer } from './ElementRenderer';
import { ConnectorRenderer } from './ConnectorRenderer';
import { createCanvasConnector, createCanvasElement } from '../../engine/elementFactory';
import type { CanvasTool, Position, Size, CanvasChange } from '../../types';

export interface UMLCanvasProps {
  width: number;
  height: number;
  /** Called when a canvas change occurs (for SyncEngine integration) */
  onCanvasChange?: (change: CanvasChange) => void;
  /** Called when an element is double-clicked (for Property Panel) */
  onElementDoubleClick?: (elementId: string) => void;
  /** Called when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;
  /** Active element placement tool */
  activeTool?: CanvasTool | null;
}

export const UMLCanvas: React.FC<UMLCanvasProps> = ({
  width,
  height,
  onCanvasChange,
  onElementDoubleClick,
  onSelectionChange,
  activeTool = null,
}) => {
  const diagram = useDiagramStore((s) => s.diagram);
  const { viewport, stageRef, handleWheel, setViewport, fitAll, handleDragEnd } =
    useCanvasControls(diagram?.viewport);

  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(new Set());
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<Set<string>>(new Set());
  const [connectorSourceId, setConnectorSourceId] = useState<string | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    start: Position;
    end: Position;
  } | null>(null);
  const isSelecting = useRef(false);

  const elements = diagram?.elements ?? [];
  const connectors = diagram?.connectors ?? [];
  const gridSize = 40;
  const gridLines = React.useMemo(() => {
    const lines: { points: number[]; major: boolean }[] = [];
    const worldLeft = -viewport.x / viewport.zoom;
    const worldTop = -viewport.y / viewport.zoom;
    const worldRight = worldLeft + width / viewport.zoom;
    const worldBottom = worldTop + height / viewport.zoom;
    const startX = Math.floor(worldLeft / gridSize) * gridSize;
    const endX = Math.ceil(worldRight / gridSize) * gridSize;
    const startY = Math.floor(worldTop / gridSize) * gridSize;
    const endY = Math.ceil(worldBottom / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
      lines.push({ points: [x, worldTop, x, worldBottom], major: x % (gridSize * 4) === 0 });
    }
    for (let y = startY; y <= endY; y += gridSize) {
      lines.push({ points: [worldLeft, y, worldRight, y], major: y % (gridSize * 4) === 0 });
    }
    return lines;
  }, [height, viewport.x, viewport.y, viewport.zoom, width]);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(Array.from(selectedElementIds));
  }, [selectedElementIds, onSelectionChange]);

  // Sync viewport from diagram store
  useEffect(() => {
    if (diagram?.viewport) {
      setViewport(diagram.viewport);
    }
    setConnectorSourceId(null);
    clearSelection();
  }, [diagram?.id]);

  useEffect(() => {
    if (activeTool?.kind !== 'connector') {
      setConnectorSourceId(null);
    }
  }, [activeTool]);

  // --- Selection ---

  const handleElementSelect = useCallback(
    (elementId: string, shiftKey: boolean) => {
      if (activeTool?.kind === 'connector' && diagram) {
        if (!connectorSourceId) {
          setConnectorSourceId(elementId);
          setSelectedElementIds(new Set([elementId]));
          setSelectedConnectorIds(new Set());
          return;
        }

        const connector = createCanvasConnector(
          diagram.type,
          activeTool.type,
          connectorSourceId,
          elementId,
        );
        if (connector) {
          onCanvasChange?.({ type: 'connector-add', connector });
          setSelectedElementIds(new Set());
          setSelectedConnectorIds(new Set([connector.id]));
        }
        setConnectorSourceId(null);
        return;
      }

      setSelectedConnectorIds(new Set());
      setSelectedElementIds((prev) => {
        const next = new Set(shiftKey ? prev : []);
        if (next.has(elementId) && shiftKey) {
          next.delete(elementId);
        } else {
          next.add(elementId);
        }
        return next;
      });
    },
    [activeTool, connectorSourceId, diagram, onCanvasChange],
  );

  const handleConnectorSelect = useCallback(
    (connectorId: string, shiftKey: boolean) => {
      setSelectedElementIds(new Set());
      setSelectedConnectorIds((prev) => {
        const next = new Set(shiftKey ? prev : []);
        if (next.has(connectorId) && shiftKey) {
          next.delete(connectorId);
        } else {
          next.add(connectorId);
        }
        return next;
      });
    },
    [],
  );

  const clearSelection = useCallback(() => {
    setSelectedElementIds(new Set());
    setSelectedConnectorIds(new Set());
  }, []);

  const isTypingTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || isTypingTarget(event.target)) {
        return;
      }

      if (selectedElementIds.size === 0 && selectedConnectorIds.size === 0) return;

      event.preventDefault();
      for (const connectorId of selectedConnectorIds) {
        onCanvasChange?.({ type: 'connector-delete', connectorId });
      }
      for (const elementId of selectedElementIds) {
        onCanvasChange?.({ type: 'element-delete', elementId });
      }
      clearSelection();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, onCanvasChange, selectedConnectorIds, selectedElementIds]);

  // --- Drag selection box ---

  const handleStageMouseDown = useCallback(
    (e: any) => {
      // Only start selection if clicking on the stage background
      if (e.target !== e.target.getStage()) return;
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Transform pointer to diagram coordinates
      const x = (pos.x - viewport.x) / viewport.zoom;
      const y = (pos.y - viewport.y) / viewport.zoom;

      if (activeTool?.kind === 'element' && diagram) {
        const element = createCanvasElement(diagram.type, activeTool.type, { x, y }, elements);
        if (element) {
          onCanvasChange?.({ type: 'element-add', element });
          setSelectedElementIds(new Set([element.id]));
          setSelectedConnectorIds(new Set());
          return;
        }
      }

      if (!e.evt.shiftKey) {
        clearSelection();
      }

      isSelecting.current = true;
      setSelectionRect({ start: { x, y }, end: { x, y } });
    },
    [activeTool, clearSelection, diagram, elements, onCanvasChange, viewport],
  );

  const handleStageMouseMove = useCallback(
    (e: any) => {
      if (!isSelecting.current) return;
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const x = (pos.x - viewport.x) / viewport.zoom;
      const y = (pos.y - viewport.y) / viewport.zoom;

      setSelectionRect((prev) => (prev ? { ...prev, end: { x, y } } : null));
    },
    [viewport],
  );

  const handleStageMouseUp = useCallback(() => {
    if (!isSelecting.current || !selectionRect) {
      isSelecting.current = false;
      setSelectionRect(null);
      return;
    }

    isSelecting.current = false;

    const { start, end } = selectionRect;
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    // Only select if the rect is big enough (avoid accidental clicks)
    if (maxX - minX > 5 || maxY - minY > 5) {
      const selected = new Set<string>();
      for (const el of elements) {
        const elRight = el.position.x + el.size.width;
        const elBottom = el.position.y + el.size.height;
        if (
          el.position.x < maxX &&
          elRight > minX &&
          el.position.y < maxY &&
          elBottom > minY
        ) {
          selected.add(el.id);
        }
      }
      setSelectedElementIds(selected);
      setSelectedConnectorIds(new Set());
    }

    setSelectionRect(null);
  }, [selectionRect, elements]);

  // --- Element actions ---

  const handleElementDragEnd = useCallback(
    (elementId: string, position: Position) => {
      const change: CanvasChange = { type: 'element-move', elementId, position };
      onCanvasChange?.(change);

      // Auto-recalculate connector paths is implicit since connectors
      // reference element positions from the store
    },
    [onCanvasChange],
  );

  const handleElementResize = useCallback(
    (elementId: string, size: Size, position: Position) => {
      onCanvasChange?.({ type: 'element-resize', elementId, size });
    },
    [onCanvasChange],
  );

  const handleElementDoubleClick = useCallback(
    (elementId: string) => {
      onElementDoubleClick?.(elementId);
    },
    [onElementDoubleClick],
  );

  // --- Connector waypoint drag ---

  const handleWaypointDragEnd = useCallback(
    (connectorId: string, waypoints: Position[]) => {
      onCanvasChange?.({ type: 'connector-waypoint', connectorId, waypoints });
    },
    [onCanvasChange],
  );

  // --- Fit all ---

  const handleFitAll = useCallback(() => {
    fitAll(elements, width, height);
  }, [fitAll, elements, width, height]);

  // --- Alignment helpers ---

  const alignElements = useCallback(
    (alignment: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') => {
      const selected = elements.filter((el) => selectedElementIds.has(el.id));
      if (selected.length < 2) return;

      for (const el of selected) {
        let newPos: Position | null = null;
        switch (alignment) {
          case 'left':
            newPos = { x: Math.min(...selected.map((e) => e.position.x)), y: el.position.y };
            break;
          case 'right': {
            const maxRight = Math.max(...selected.map((e) => e.position.x + e.size.width));
            newPos = { x: maxRight - el.size.width, y: el.position.y };
            break;
          }
          case 'center-h': {
            const avgX = selected.reduce((s, e) => s + e.position.x + e.size.width / 2, 0) / selected.length;
            newPos = { x: avgX - el.size.width / 2, y: el.position.y };
            break;
          }
          case 'top':
            newPos = { x: el.position.x, y: Math.min(...selected.map((e) => e.position.y)) };
            break;
          case 'bottom': {
            const maxBottom = Math.max(...selected.map((e) => e.position.y + e.size.height));
            newPos = { x: el.position.x, y: maxBottom - el.size.height };
            break;
          }
          case 'center-v': {
            const avgY = selected.reduce((s, e) => s + e.position.y + e.size.height / 2, 0) / selected.length;
            newPos = { x: el.position.x, y: avgY - el.size.height / 2 };
            break;
          }
        }
        if (newPos && (newPos.x !== el.position.x || newPos.y !== el.position.y)) {
          onCanvasChange?.({ type: 'element-move', elementId: el.id, position: newPos });
        }
      }
    },
    [elements, selectedElementIds, onCanvasChange],
  );

  const distributeElements = useCallback(
    (direction: 'horizontal' | 'vertical') => {
      const selected = elements.filter((el) => selectedElementIds.has(el.id));
      if (selected.length < 3) return;

      const sorted = [...selected].sort((a, b) =>
        direction === 'horizontal' ? a.position.x - b.position.x : a.position.y - b.position.y,
      );

      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      if (direction === 'horizontal') {
        const totalSpace = last.position.x + last.size.width - first.position.x;
        const totalElementWidth = sorted.reduce((s, e) => s + e.size.width, 0);
        const gap = (totalSpace - totalElementWidth) / (sorted.length - 1);
        let currentX = first.position.x;
        for (const el of sorted) {
          if (el.position.x !== currentX) {
            onCanvasChange?.({ type: 'element-move', elementId: el.id, position: { x: currentX, y: el.position.y } });
          }
          currentX += el.size.width + gap;
        }
      } else {
        const totalSpace = last.position.y + last.size.height - first.position.y;
        const totalElementHeight = sorted.reduce((s, e) => s + e.size.height, 0);
        const gap = (totalSpace - totalElementHeight) / (sorted.length - 1);
        let currentY = first.position.y;
        for (const el of sorted) {
          if (el.position.y !== currentY) {
            onCanvasChange?.({ type: 'element-move', elementId: el.id, position: { x: el.position.x, y: currentY } });
          }
          currentY += el.size.height + gap;
        }
      }
    },
    [elements, selectedElementIds, onCanvasChange],
  );

  // --- Selection rect rendering ---
  const selectionRectCoords = selectionRect
    ? {
        x: Math.min(selectionRect.start.x, selectionRect.end.x),
        y: Math.min(selectionRect.start.y, selectionRect.end.y),
        width: Math.abs(selectionRect.end.x - selectionRect.start.x),
        height: Math.abs(selectionRect.end.y - selectionRect.start.y),
      }
    : null;

  return (
    <div className="canvas-shell" style={{ width, height }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={viewport.zoom}
        scaleY={viewport.zoom}
        x={viewport.x}
        y={viewport.y}
        draggable={!activeTool}
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
      >
        <Layer listening={false}>
          <Rect
            x={-viewport.x / viewport.zoom}
            y={-viewport.y / viewport.zoom}
            width={width / viewport.zoom}
            height={height / viewport.zoom}
            fill="#f8fafc"
          />
          {gridLines.map((line, index) => (
            <Line
              key={index}
              points={line.points}
              stroke={line.major ? '#dbe4ef' : '#edf2f7'}
              strokeWidth={line.major ? 1 : 0.7}
            />
          ))}
        </Layer>
        <Layer>
          {/* Connectors rendered below elements */}
          {connectors.map((conn) => (
            <ConnectorRenderer
              key={conn.id}
              connector={conn}
              elements={elements}
              isSelected={selectedConnectorIds.has(conn.id)}
              onSelect={handleConnectorSelect}
              onWaypointDragEnd={handleWaypointDragEnd}
            />
          ))}

          {/* Elements */}
          {elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              isSelected={selectedElementIds.has(el.id)}
              onSelect={handleElementSelect}
              onDragEnd={handleElementDragEnd}
              onResize={handleElementResize}
              onDoubleClick={handleElementDoubleClick}
            />
          ))}

          {/* Selection rectangle */}
          {selectionRectCoords && (
            <Rect
              x={selectionRectCoords.x}
              y={selectionRectCoords.y}
              width={selectionRectCoords.width}
              height={selectionRectCoords.height}
              fill="rgba(25, 118, 210, 0.1)"
              stroke="#1976D2"
              strokeWidth={1}
              dash={[4, 4]}
            />
          )}
        </Layer>
      </Stage>

      {activeTool?.kind === 'connector' && (
        <div className="canvas-hint">
          {connectorSourceId ? 'Choose the target element to finish the connector.' : 'Choose a source element to start the connector.'}
        </div>
      )}

      {/* Fit-all button */}
      <div className="canvas-controls">
        <button
          onClick={handleFitAll}
          className="canvas-floating-button"
          title="Fit all elements in view"
        >
          Fit All
        </button>
      </div>

      {/* Zoom indicator */}
      <div className="zoom-badge">
        {Math.round(viewport.zoom * 100)}%
      </div>
    </div>
  );
};

// Re-export helpers for external use (alignment/distribution)
export type AlignmentType = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';
export type DistributeType = 'horizontal' | 'vertical';
