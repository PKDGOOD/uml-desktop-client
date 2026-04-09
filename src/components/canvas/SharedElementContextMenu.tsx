// =============================================================================
// SharedElementContextMenu - Right-click context menu for Shared_Element
// =============================================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';

export interface ReferencingDiagram {
  id: string;
  name: string;
}

export interface SharedElementContextMenuProps {
  /** Whether the menu is visible */
  visible: boolean;
  /** Screen position for the menu */
  position: { x: number; y: number };
  /** The shared element's reference ID */
  sharedRefId: string;
  /** List of diagrams referencing this shared element */
  referencingDiagrams: ReferencingDiagram[];
  /** Called when user selects a diagram to navigate to */
  onNavigate: (diagramId: string) => void;
  /** Called when the menu should close */
  onClose: () => void;
}

export const SharedElementContextMenu: React.FC<SharedElementContextMenuProps> = ({
  visible,
  position,
  sharedRefId,
  referencingDiagrams,
  onNavigate,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Close on Escape
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose]);

  // Reset submenu when menu closes
  useEffect(() => {
    if (!visible) setSubmenuOpen(false);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 1000,
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        minWidth: 180,
        fontSize: 13,
      }}
    >
      {/* Go to referencing diagram */}
      <div
        onMouseEnter={() => setSubmenuOpen(true)}
        onMouseLeave={() => setSubmenuOpen(false)}
        style={{ position: 'relative' }}
      >
        <div
          style={{
            padding: '8px 12px',
            cursor: referencingDiagrams.length > 0 ? 'pointer' : 'default',
            color: referencingDiagrams.length > 0 ? '#333' : '#aaa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            if (referencingDiagrams.length > 0) {
              (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
        >
          <span>Go to referencing diagram</span>
          {referencingDiagrams.length > 0 && <span style={{ fontSize: 10 }}>▸</span>}
        </div>

        {/* Submenu: list of referencing diagrams */}
        {submenuOpen && referencingDiagrams.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '100%',
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              minWidth: 160,
            }}
          >
            {referencingDiagrams.map((d) => (
              <div
                key={d.id}
                onClick={() => {
                  onNavigate(d.id);
                  onClose();
                }}
                style={{
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                {d.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {referencingDiagrams.length === 0 && (
        <div style={{ padding: '4px 12px 8px', fontSize: 11, color: '#999' }}>
          No referencing diagrams
        </div>
      )}
    </div>
  );
};
