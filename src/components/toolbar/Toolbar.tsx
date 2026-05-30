// =============================================================================
// Toolbar - Diagram type selector + dynamic tool palette
// =============================================================================

import React, { useState, useCallback } from 'react';
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

const CLASS_CONNECTOR_TOOLS: { type: ConnectorType; label: string }[] = [
  { type: 'directed-association', label: 'Association' },
  { type: 'dependency', label: 'Dependency' },
  { type: 'inheritance', label: 'Inheritance' },
  { type: 'composition', label: 'Composition' },
];

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
  /** Called when a tool is clicked to activate canvas creation mode */
  onToolSelect: (tool: CanvasTool) => void;
  /** Currently active tool (for highlighting) */
  activeTool?: CanvasTool | null;
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
    <div className="toolbar">
      {/* Diagram type selector dropdown */}
      <div className="diagram-select">
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="tool-button diagram-select-button"
        >
          {DIAGRAM_TYPE_LABELS[diagramType]} v
        </button>
        {dropdownOpen && (
          <div className="diagram-select-menu">
            {(Object.keys(DIAGRAM_TYPE_LABELS) as DiagramType[]).map((type) => (
              <div
                key={type}
                onClick={() => handleDiagramTypeSelect(type)}
                className={`diagram-select-item${type === diagramType ? ' is-active' : ''}`}
              >
                {DIAGRAM_TYPE_LABELS[type]}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="toolbar-separator" />

      {/* Tool palette */}
      <div className="toolbar-group">
        {tools.map((tool) => (
          <button
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

      {diagramType === 'class' && (
        <>
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            {CLASS_CONNECTOR_TOOLS.map((tool) => (
              <button
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
