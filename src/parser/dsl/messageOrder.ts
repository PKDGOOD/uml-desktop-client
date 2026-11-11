import type { Connector, ConnectorType, DiagramData } from '@/types';

const MESSAGE_TYPES: ReadonlySet<ConnectorType> = new Set<ConnectorType>(['sync-message', 'async-message', 'return-message']);

export const isMessage = (connector: Connector): boolean => MESSAGE_TYPES.has(connector.type);

/**
 * Connectors in display order (A04.08): by `messageOrder`, ties and missing
 * values by array position. The DSL writes messages in this order.
 */
export function inDisplayOrder(connectors: readonly Connector[]): Connector[] {
  return connectors
    .map((connector, index) => ({ connector, index }))
    .sort((a, b) => (a.connector.messageOrder ?? Infinity) - (b.connector.messageOrder ?? Infinity) || a.index - b.index)
    .map(({ connector }) => connector);
}

/**
 * Number the messages of a sequence diagram 1..n in their current display order,
 * optionally moving one of them to `moveTo` (1-based, clamped) first.
 * Mutates `diagram`; other diagram types are left alone.
 */
export function renumberMessages(diagram: DiagramData, moved?: { id: string; to: number }): void {
  if (diagram.type !== 'sequence') return;
  const messages = inDisplayOrder(diagram.connectors.filter(isMessage));
  if (moved) {
    const from = messages.findIndex((connector) => connector.id === moved.id);
    if (from >= 0) {
      const [connector] = messages.splice(from, 1);
      const to = Math.min(Math.max(Math.trunc(moved.to) || 1, 1), messages.length + 1);
      messages.splice(to - 1, 0, connector);
    }
  }
  messages.forEach((connector, index) => { connector.messageOrder = index + 1; });
}

/** Row of each connector in a sequence diagram (0-based, display order), for vertical placement. */
export function messageRows(connectors: readonly Connector[]): Map<string, number> {
  return new Map(inDisplayOrder(connectors).map((connector, row) => [connector.id, row]));
}
