import type { Connector, ConnectorUpdate } from '../../types';

/** What the connector form edits as one buffered draft (A05.04). */
export interface ConnectorDraft {
  sourceId: string;
  targetId: string;
  label: string;
}

export const connectorDraftFrom = (connector: Connector): ConnectorDraft => ({
  sourceId: connector.sourceId,
  targetId: connector.targetId,
  label: connector.label ?? '',
});

/** The `connector-update` for what changed, or an empty object. An emptied label clears it. */
export function connectorChanges(original: Connector, draft: ConnectorDraft): ConnectorUpdate {
  const changes: ConnectorUpdate = {};
  if (draft.sourceId !== original.sourceId) changes.sourceId = draft.sourceId;
  if (draft.targetId !== original.targetId) changes.targetId = draft.targetId;
  if (draft.label !== (original.label ?? '')) changes.label = draft.label === '' ? undefined : draft.label;
  return changes;
}

export const isConnectorDirty = (original: Connector, draft: ConnectorDraft): boolean =>
  Object.keys(connectorChanges(original, draft)).length > 0;

/** Swap the two ends in the draft. */
export const swapEnds = (draft: ConnectorDraft): ConnectorDraft => ({ ...draft, sourceId: draft.targetId, targetId: draft.sourceId });

/** One line that says what the connector joins and in which direction. */
export function describeConnector(connector: Pick<Connector, 'type' | 'sourceId' | 'targetId'>, nameOf: (id: string) => string): string {
  return `${nameOf(connector.sourceId)} → ${nameOf(connector.targetId)} (${connector.type.replace(/-/g, ' ')})`;
}
