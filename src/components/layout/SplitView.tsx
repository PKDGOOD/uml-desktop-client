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
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}
    >
      {/* View mode toggle buttons */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '4px 8px',
          borderBottom: '1px solid #ddd',
          background: '#fafafa',
          flexShrink: 0,
        }}
      >
        {(['editor-only', 'split', 'canvas-only'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => toggleMode(mode)}
            style={{
              padding: '3px 10px',
              fontSize: 12,
              border: '1px solid #ccc',
              borderRadius: 3,
              background: viewMode === mode ? '#1976D2' : '#fff',
              color: viewMode === mode ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            {mode === 'editor-only' ? 'Editor' : mode === 'canvas-only' ? 'Canvas' : 'Split'}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Editor panel */}
        {viewMode !== 'canvas-only' && (
          <div
            style={{
              width: viewMode === 'editor-only' ? '100%' : `${ratio * 100}%`,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {editorPanel}
          </div>
        )}

        {/* Draggable divider */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              width: 5,
              cursor: 'col-resize',
              background: isDragging.current ? '#1976D2' : '#ddd',
              flexShrink: 0,
              transition: 'background 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = '#bbb';
            }}
            onMouseLeave={(e) => {
              if (!isDragging.current) {
                (e.currentTarget as HTMLDivElement).style.background = '#ddd';
              }
            }}
          />
        )}

        {/* Canvas panel */}
        {viewMode !== 'editor-only' && (
          <div
            style={{
              width: viewMode === 'canvas-only' ? '100%' : `${(1 - ratio) * 100}%`,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {canvasPanel}
          </div>
        )}
      </div>
    </div>
  );
};
