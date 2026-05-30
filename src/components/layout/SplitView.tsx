// =============================================================================
// SplitView - Text Editor (left) + Canvas (right) split layout
// =============================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';

export type ViewMode = 'split' | 'canvas-only' | 'editor-only';

const STORAGE_KEY_VIEW_MODE = 'uml-split-view-mode';
const STORAGE_KEY_DIVIDER_POS = 'uml-split-divider-pos';
const MIN_PANEL_WIDTH = 100;
const DEFAULT_RATIO = 0.4; // 40% editor, 60% canvas

export interface SplitViewProps {
  /** Left panel content (Text Editor) */
  editorPanel: React.ReactNode;
  /** Right panel content (Canvas) */
  canvasPanel: React.ReactNode;
}

export const SplitView: React.FC<SplitViewProps> = ({ editorPanel, canvasPanel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Restore persisted state
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (sessionStorage.getItem(STORAGE_KEY_VIEW_MODE) as ViewMode) || 'split';
    } catch {
      return 'split';
    }
  });

  const [ratio, setRatio] = useState<number>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_DIVIDER_POS);
      return stored ? parseFloat(stored) : DEFAULT_RATIO;
    } catch {
      return DEFAULT_RATIO;
    }
  });

  // Persist view mode and divider position
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_VIEW_MODE, viewMode);
    } catch { /* ignore */ }
  }, [viewMode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY_DIVIDER_POS, String(ratio));
    } catch { /* ignore */ }
  }, [ratio]);

  // Divider drag handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      let newRatio = (e.clientX - rect.left) / totalWidth;
      // Clamp so neither panel is too small
      const minRatio = MIN_PANEL_WIDTH / totalWidth;
      const maxRatio = 1 - minRatio;
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));
      setRatio(newRatio);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const toggleMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  return (
    <div
      ref={containerRef}
      className="split-view"
    >
      {/* View mode toggle buttons */}
      <div className="view-toggle">
        {(['editor-only', 'split', 'canvas-only'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => toggleMode(mode)}
            className={`view-mode-button${viewMode === mode ? ' is-active' : ''}`}
          >
            {mode === 'editor-only' ? 'Editor' : mode === 'canvas-only' ? 'Canvas' : 'Split'}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="split-panels">
        {/* Editor panel */}
        {viewMode !== 'canvas-only' && (
          <div
            className="split-panel"
            style={{
              width: viewMode === 'editor-only' ? '100%' : `${ratio * 100}%`,
            }}
          >
            {editorPanel}
          </div>
        )}

        {/* Draggable divider */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleMouseDown}
            className={`split-divider${isDragging.current ? ' is-dragging' : ''}`}
          />
        )}

        {/* Canvas panel */}
        {viewMode !== 'editor-only' && (
          <div
            className="split-panel"
            style={{
              width: viewMode === 'canvas-only' ? '100%' : `${(1 - ratio) * 100}%`,
            }}
          >
            {canvasPanel}
          </div>
        )}
      </div>
    </div>
  );
};
