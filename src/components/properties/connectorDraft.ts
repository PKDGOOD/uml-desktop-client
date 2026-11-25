import type { Connector, ConnectorUpdate } from '../../types';
import { multiplicityProblem } from '../../engine/diagramRules';

/** What the connector form edits as one buffered draft (A05.04). */
export interface ConnectorDraft {
  sourceId: string;
  targetId: string;
  label: string;
  sourceMultiplicity: string;
  targetMultiplicity: string;
}

export const connectorDraftFrom = (connector: Connector): ConnectorDraft => ({
  sourceId: connector.sourceId,
  targetId: connector.targetId,
  label: connector.label ?? '',
  sourceMultiplicity: connector.sourceMultiplicity ?? '',
  targetMultiplicity: connector.targetMultiplicity ?? '',
});

/** The `connector-update` for what changed, or an empty object. An emptied label clears it. */
export function connectorChanges(original: Connector, draft: ConnectorDraft): ConnectorUpdate {
  const changes: ConnectorUpdate = {};
  if (draft.sourceId !== original.sourceId) changes.sourceId = draft.sourceId;
  if (draft.targetId !== original.targetId) changes.targetId = draft.targetId;
  if (draft.label !== (original.label ?? '')) changes.label = draft.label === '' ? undefined : draft.label;
  for (const end of ['sourceMultiplicity', 'targetMultiplicity'] as const) {
    const value = draft[end].trim();
    if (value !== (original[end] ?? '')) changes[end] = value === '' ? undefined : value;
  }
  return changes;
}

/** Problems the form can see without the engine: an invalid multiplicity range, per end. */
export function multiplicityProblems(draft: ConnectorDraft): Partial<Record<'sourceMultiplicity' | 'targetMultiplicity', string>> {
  const problems: Partial<Record<'sourceMultiplicity' | 'targetMultiplicity', string>> = {};
  for (const end of ['sourceMultiplicity', 'targetMultiplicity'] as const) {
    const value = draft[end].trim();
    const problem = value === '' ? undefined : multiplicityProblem(value);
    if (problem) problems[end] = `${end === 'sourceMultiplicity' ? 'From' : 'To'} multiplicity: ${problem}`;
  }
  return problems;
}

export const isConnectorDirty = (original: Connector, draft: ConnectorDraft): boolean =>
  Object.keys(connectorChanges(original, draft)).length > 0;

/** Swap the two ends in the draft. */
export const swapEnds = (draft: ConnectorDraft): ConnectorDraft => ({ ...draft, sourceId: draft.targetId, targetId: draft.sourceId });

/** One line that says what the connector joins and in which direction. */
export function describeConnector(connector: Pick<Connector, 'type' | 'sourceId' | 'targetId'>, nameOf: (id: string) => string): string {
  return `${nameOf(connector.sourceId)} → ${nameOf(connector.targetId)} (${connector.type.replace(/-/g, ' ')})`;
}
