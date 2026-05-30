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
    <div className="tabs">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`tab${isActive ? ' is-active' : ''}`}
          >
            {/* Dirty indicator */}
            {tab.dirty && (
              <span className="dirty-dot" title="Unsaved changes" />
            )}

            <span className="tab-name">{tab.name}</span>

            {/* Close button */}
            <button
              onClick={(e) => handleClose(e, tab.id, tab.dirty)}
              className="tab-close"
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
