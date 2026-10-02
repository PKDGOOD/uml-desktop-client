// =============================================================================
// Toolbar - Diagram type selector + dynamic tool palette
// =============================================================================

import React from 'react';
import { CONNECTOR_TYPES } from '../../engine/elementFactory';
import type { CanvasTool, ConnectorType, DiagramType, ElementType } from '../../types';

/** Tools available per diagram type */
export const DIAGRAM_TOOLS: Record<DiagramType, { type: ElementType; label: string }[]> = {
  class: [
    { type: 'class', label: 'Class' },
    { type: 'interface', label: 'Interface' },
    { type: 'abstract-class', label: 'Abstract Class' },
    { type: 'enum', label: 'Enum' },
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
  disabled?: boolean;
  /** Called when a tool is clicked to activate canvas creation mode */
  onToolSelect: (tool: CanvasTool) => void;
  /** Currently active tool (for highlighting) */
  activeTool?: CanvasTool | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  diagramType,
  disabled = false,
  onToolSelect,
  activeTool = null,
}) => {
  const tools = DIAGRAM_TOOLS[diagramType] ?? [];

  return (
    <div className="toolbar">
      <span className="diagram-type-label">{DIAGRAM_TYPE_LABELS[diagramType]}</span>
      {/* Separator */}
      <div className="toolbar-separator" />

      {/* Tool palette */}
      <div className="toolbar-group">
        {tools.map((tool) => (
          <button
            disabled={disabled}
            key={tool.type}
            onClick={() => onToolSelect({ kind: 'element', type: tool.type })}
            title={tool.label}
            className={`tool-button${
              activeTool?.kind === 'element' && activeTool.type === tool.type ? ' is-active' : ''
            }`}
          >
            {tool.label}
          </button>
        ))}
      </div>

      {!disabled && (
        <>
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            {CONNECTOR_TYPES[diagramType].map((type) => ({ type, label: type.replace(/-/g, ' ') })).map((tool) => (
              <button
                disabled={disabled}
                key={tool.type}
                onClick={() => onToolSelect({ kind: 'connector', type: tool.type })}
                title={tool.label}
                className={`tool-button${
                  activeTool?.kind === 'connector' && activeTool.type === tool.type ? ' is-active' : ''
                }`}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
