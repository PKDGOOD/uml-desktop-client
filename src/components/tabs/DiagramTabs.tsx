// =============================================================================
// DiagramTabs - Tab bar for open diagrams
// =============================================================================

import React, { useCallback } from 'react';

export interface DiagramTabInfo {
  id: string;
  name: string;
  dirty: boolean;
}

export interface DiagramTabsProps {
  /** List of open diagram tabs */
  tabs: DiagramTabInfo[];
  /** Currently active tab ID */
  activeTabId: string | null;
  /** Called when a tab is clicked to switch */
  onTabClick: (diagramId: string) => void;
  /** Called when a tab close button is clicked */
  onTabClose: (diagramId: string) => void;
}

export const DiagramTabs: React.FC<DiagramTabsProps> = ({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
}) => {
  const handleClose = useCallback(
    (e: React.MouseEvent, diagramId: string, dirty: boolean) => {
      e.stopPropagation();
      if (dirty) {
        if (!window.confirm('This diagram has unsaved changes. Close anyway?')) {
          return;
        }
      }
      onTabClose(diagramId);
    },
    [onTabClose],
  );

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        overflowX: 'auto',
        borderBottom: '1px solid #ddd',
        background: '#f5f5f5',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
              borderRight: '1px solid #ddd',
              background: isActive ? '#fff' : 'transparent',
              borderBottom: isActive ? '2px solid #1976D2' : '2px solid transparent',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {/* Dirty indicator */}
            {tab.dirty && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#ff9800',
                  flexShrink: 0,
                }}
                title="Unsaved changes"
              />
            )}

            <span>{tab.name}</span>

            {/* Close button */}
            <button
              onClick={(e) => handleClose(e, tab.id, tab.dirty)}
              style={{
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                color: '#888',
                marginLeft: 2,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#c00';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = '#888';
              }}
              title="Close tab"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};
