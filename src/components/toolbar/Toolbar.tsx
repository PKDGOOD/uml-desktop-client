// =============================================================================
// Toolbar - Diagram type selector + dynamic tool palette
// =============================================================================

import React, { useState, useCallback } from 'react';
import type { DiagramType, ElementType } from '../../types';

/** Tools available per diagram type */
export const DIAGRAM_TOOLS: Record<DiagramType, { type: ElementType; label: string }[]> = {
  class: [
    { type: 'class', label: 'Class' },
    { type: 'interface', label: 'Interface' },
    { type: 'abstract-class', label: 'Abstract Class' },
    { type: 'enum', label: 'Enum' },
    { type: 'note', label: 'Note' },
  ],
  sequence: [
    { type: 'lifeline', label: 'Lifeline' },
  ],
  usecase: [
    { type: 'actor', label: 'Actor' },
    { type: 'usecase', label: 'Use Case' },
    { type: 'system-boundary', label: 'System Boundary' },
  ],
  activity: [
    { type: 'action', label: 'Action' },
    { type: 'decision', label: 'Decision' },
    { type: 'fork', label: 'Fork' },
    { type: 'join', label: 'Join' },
    { type: 'initial-node', label: 'Initial Node' },
    { type: 'final-node', label: 'Final Node' },
  ],
  state: [
    { type: 'state', label: 'State' },
    { type: 'composite-state', label: 'Composite State' },
    { type: 'initial-state', label: 'Initial State' },
    { type: 'final-state', label: 'Final State' },
  ],
};

const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  class: 'Class Diagram',
  sequence: 'Sequence Diagram',
  usecase: 'Use Case Diagram',
  activity: 'Activity Diagram',
  state: 'State Diagram',
};

export interface ToolbarProps {
  /** Currently selected diagram type */
  diagramType: DiagramType;
  /** Called when diagram type changes */
  onDiagramTypeChange: (type: DiagramType) => void;
  /** Called when a tool is clicked to activate element placement mode */
  onToolSelect: (elementType: ElementType) => void;
  /** Currently active tool (for highlighting) */
  activeTool?: ElementType | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  diagramType,
  onDiagramTypeChange,
  onToolSelect,
  activeTool = null,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleDiagramTypeSelect = useCallback(
    (type: DiagramType) => {
      onDiagramTypeChange(type);
      setDropdownOpen(false);
    },
    [onDiagramTypeChange],
  );

  const tools = DIAGRAM_TOOLS[diagramType] ?? [];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid #ddd',
        background: '#fafafa',
        flexShrink: 0,
      }}
    >
      {/* Diagram type selector dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          style={{
            padding: '4px 12px',
            fontSize: 12,
            border: '1px solid #ccc',
            borderRadius: 3,
            background: '#fff',
            cursor: 'pointer',
            minWidth: 140,
            textAlign: 'left',
          }}
        >
          {DIAGRAM_TYPE_LABELS[diagramType]} ▾
        </button>
        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 100,
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 3,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              minWidth: 160,
            }}
          >
            {(Object.keys(DIAGRAM_TYPE_LABELS) as DiagramType[]).map((type) => (
              <div
                key={type}
                onClick={() => handleDiagramTypeSelect(type)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  background: type === diagramType ? '#e3f2fd' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    type === diagramType ? '#e3f2fd' : 'transparent';
                }}
              >
                {DIAGRAM_TYPE_LABELS[type]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 24, background: '#ddd' }} />

      {/* Tool palette */}
      {tools.map((tool) => (
        <button
          key={tool.type}
          onClick={() => onToolSelect(tool.type)}
          title={tool.label}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            border: '1px solid',
            borderColor: activeTool === tool.type ? '#1976D2' : '#ccc',
            borderRadius: 3,
            background: activeTool === tool.type ? '#e3f2fd' : '#fff',
            color: activeTool === tool.type ? '#1976D2' : '#333',
            cursor: 'pointer',
          }}
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
};
