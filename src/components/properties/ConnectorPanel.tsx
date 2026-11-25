// =============================================================================
// ConnectorPanel - Endpoints and label of the selected connector (A05.04)
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Connector, ConnectorUpdate, DiagramElement, DiagramType } from '../../types';
import { multiplicityApplies } from '../../engine/diagramRules';
import {
  connectorChanges, connectorDraftFrom, describeConnector, isConnectorDirty, multiplicityProblems, swapEnds, type ConnectorDraft,
} from './connectorDraft';
import type { PendingFormGuard } from './pendingForm';

export interface ConnectorPanelProps {
  connector: Connector;
  /** Every element of the diagram, for the endpoint choices and names. */
  elements: DiagramElement[];
  /** Decides whether multiplicity fields are offered. */
  diagramType: DiagramType;
  /** Applies the edit; returns why it was refused, or null. */
  onConnectorChange: (connectorId: string, changes: ConnectorUpdate) => string | null | void;
  disabled?: boolean;
  registerGuard?: (guard: PendingFormGuard | null) => void;
}

export const ConnectorPanel: React.FC<ConnectorPanelProps> = ({
  connector, elements, diagramType, onConnectorChange, disabled = false, registerGuard,
}) => {
  const nameOf = useCallback(
    (id: string) => elements.find((element) => element.id === id)?.properties.name ?? id,
    [elements],
  );
  const [draft, setDraft] = useState<ConnectorDraft>(connectorDraftFrom(connector));
  const [problem, setProblem] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const dirty = isConnectorDirty(connector, draft);

  // The saved connector changing (Apply, undo, a text edit, another selection) reloads the draft.
  const savedKey = JSON.stringify([connector.id, connector.sourceId, connector.targetId, connector.label ?? '', connector.sourceMultiplicity ?? '', connector.targetMultiplicity ?? '']);
  useEffect(() => {
    setDraft(connectorDraftFrom(connector));
    setProblem(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const update = (change: Partial<ConnectorDraft>) => { setDraft((current) => ({ ...current, ...change })); setProblem(null); };

  const apply = useCallback((): string | null => {
    const changes = connectorChanges(connector, draft);
    if (Object.keys(changes).length === 0) return null;
    // An invalid range never reaches the model.
    const invalid = multiplicityProblems(draft);
    const local = invalid.sourceMultiplicity ?? invalid.targetMultiplicity;
    if (local) { setProblem(local); return local; }
    const refusal = onConnectorChange(connector.id, changes) ?? null;
    // A refusal leaves the connector as it was; the form keeps the draft and says why.
    setProblem(refusal);
    return refusal;
  }, [connector, draft, onConnectorChange]);

  const discard = useCallback(() => { setDraft(connectorDraftFrom(connector)); setProblem(null); }, [connector]);

  useEffect(() => {
    if (!registerGuard) return;
    registerGuard({
      label: describeConnector(connector, nameOf),
      isDirty: () => isConnectorDirty(connector, draft),
      apply,
      discard,
    });
  }, [registerGuard, connector, draft, apply, discard, nameOf]);
  useEffect(() => () => registerGuard?.(null), [registerGuard]);

  useEffect(() => { if (problem) alertRef.current?.focus(); }, [problem]);

  const withMultiplicity = multiplicityApplies(diagramType, connector.type);
  const invalid = multiplicityProblems(draft);
  const options = elements.map((element) => <option key={element.id} value={element.id}>{element.properties.name}</option>);

  return (
    <div className="property-panel">
      <div className="panel-header">
        <div className="panel-title">Connection</div>
        <div className="panel-title">{connector.type.replace(/-/g, ' ')}</div>
      </div>
      {disabled && <div className="panel-note" role="status">Fix the DSL errors to edit connections.</div>}
      <fieldset className="property-body" disabled={disabled} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
        <div className="connector-summary" aria-label="Direction">{describeConnector(connector, nameOf)}</div>

        <label className="field-label" htmlFor="connector-source">From</label>
        <select id="connector-source" className="field-select" value={draft.sourceId} onChange={(e) => update({ sourceId: e.target.value })}>
          {options}
        </select>

        <label className="field-label" htmlFor="connector-target">To</label>
        <select id="connector-target" className="field-select" value={draft.targetId} onChange={(e) => update({ targetId: e.target.value })}>
          {options}
        </select>

        <button className="panel-button" onClick={() => setDraft(swapEnds)} style={{ marginTop: 6 }}>Swap direction</button>

        <label className="field-label" htmlFor="connector-label">Label</label>
        <input id="connector-label" className="field-input" value={draft.label} onChange={(e) => update({ label: e.target.value })} />

        {withMultiplicity && (
          <>
            <label className="field-label" htmlFor="connector-source-multiplicity">From multiplicity</label>
            <input id="connector-source-multiplicity" className="field-input" placeholder="e.g. 1, 0..1, 1..*, *"
              value={draft.sourceMultiplicity} onChange={(e) => update({ sourceMultiplicity: e.target.value })}
              aria-invalid={!!invalid.sourceMultiplicity || undefined} />
            <label className="field-label" htmlFor="connector-target-multiplicity">To multiplicity</label>
            <input id="connector-target-multiplicity" className="field-input" placeholder="e.g. 1, 0..1, 1..*, *"
              value={draft.targetMultiplicity} onChange={(e) => update({ targetMultiplicity: e.target.value })}
              aria-invalid={!!invalid.targetMultiplicity || undefined} />
          </>
        )}

        <div className="form-actions">
          {problem && <div className="form-error" role="alert" tabIndex={-1} ref={alertRef}>{problem}</div>}
          <button className="panel-button" onClick={() => { apply(); }} disabled={!dirty}>Apply</button>
          <button className="panel-button" onClick={discard} disabled={!dirty}>Cancel</button>
        </div>
      </fieldset>
    </div>
  );
};
