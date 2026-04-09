// =============================================================================
// useCanvasControls - Hook for zoom, pan, and fit-all viewport controls
// =============================================================================

import { useState, useCallback, useRef } from 'react';
import type { DiagramElement, Viewport } from '../../types';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4.0;
const ZOOM_STEP = 0.1;

export interface CanvasControlsState {
  viewport: Viewport;
  stageRef: React.RefObject<any>;
  /** Handle mouse wheel zoom (25% – 400%) */
  handleWheel: (e: any) => void;
  /** Set viewport directly */
  setViewport: (vp: Viewport) => void;
  /** Fit all elements into view */
  fitAll: (elements: DiagramElement[], stageWidth: number, stageHeight: number) => void;
  /** Handle stage drag end (panning) */
  handleDragEnd: (e: any) => void;
}

export function useCanvasControls(initialViewport?: Viewport): CanvasControlsState {
  const [viewport, setViewport] = useState<Viewport>(
    initialViewport ?? { x: 0, y: 0, zoom: 1 },
  );
  const stageRef = useRef<any>(null);

  const handleWheel = useCallback(
    (e: any) => {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (!stage) return;

      const oldZoom = viewport.zoom;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom + direction * ZOOM_STEP));

      // Zoom toward pointer position
      const mousePointTo = {
        x: (pointer.x - viewport.x) / oldZoom,
        y: (pointer.y - viewport.y) / oldZoom,
      };

      const newX = pointer.x - mousePointTo.x * newZoom;
      const newY = pointer.y - mousePointTo.y * newZoom;

      setViewport({ x: newX, y: newY, zoom: newZoom });
    },
    [viewport],
  );

  const handleDragEnd = useCallback((e: any) => {
    const stage = e.target;
    if (stage === e.target.getStage()) {
      setViewport((prev) => ({
        ...prev,
        x: stage.x(),
        y: stage.y(),
      }));
    }
  }, []);

  const fitAll = useCallback(
    (elements: DiagramElement[], stageWidth: number, stageHeight: number) => {
      if (elements.length === 0) {
        setViewport({ x: 0, y: 0, zoom: 1 });
        return;
      }

      const padding = 40;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const el of elements) {
        minX = Math.min(minX, el.position.x);
        minY = Math.min(minY, el.position.y);
        maxX = Math.max(maxX, el.position.x + el.size.width);
        maxY = Math.max(maxY, el.position.y + el.size.height);
      }

      const contentWidth = maxX - minX;
      const contentHeight = maxY - minY;

      if (contentWidth <= 0 || contentHeight <= 0) {
        setViewport({ x: 0, y: 0, zoom: 1 });
        return;
      }

      const scaleX = (stageWidth - padding * 2) / contentWidth;
      const scaleY = (stageHeight - padding * 2) / contentHeight;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(scaleX, scaleY)));

      const x = (stageWidth - contentWidth * zoom) / 2 - minX * zoom;
      const y = (stageHeight - contentHeight * zoom) / 2 - minY * zoom;

      setViewport({ x, y, zoom });
    },
    [],
  );

  return { viewport, stageRef, handleWheel, setViewport, fitAll, handleDragEnd };
}
