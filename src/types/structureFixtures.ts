// Detached model fixtures for explicit containment and message order (A02.03).
// Array order is deliberately misleading: a reader that infers ownership or
// message order from it gets the wrong answer.

import type { Connector, DiagramData, DiagramElement, ElementType } from './index';

function element(id: string, type: ElementType, name: string, parentId?: string): DiagramElement {
  return {
    id, type,
    position: { x: 0, y: 0 },
    size: { width: 120, height: 60 },
    properties: { name },
    ...(parentId ? { parentId } : {}),
  };
}

function link(id: string, type: Connector['type'], sourceId: string, targetId: string,
  label?: string, messageOrder?: number): Connector {
  return {
    id, type, sourceId, targetId, properties: {},
    ...(label ? { label } : {}),
    ...(messageOrder ? { messageOrder } : {}),
  };
}

/** F2 shape: `Outside` follows `Active`'s child but is a top-level sibling. */
export const nestedStateDiagram: DiagramData = {
  id: 'd-state', name: 'Nested state', type: 'state',
  viewport: { x: 0, y: 0, zoom: 1 },
  elements: [
    element('s-start', 'initial-state', 'Start'),
    element('s-active', 'composite-state', 'Active'),
    element('s-inside', 'state', 'Inside', 's-active'),
    element('s-outside', 'state', 'Outside'),
    element('s-review', 'composite-state', 'Review', 's-active'),
    element('s-check', 'state', 'Check', 's-review'),
    element('s-end', 'final-state', 'End'),
  ],
  connectors: [
    link('t-1', 'transition', 's-start', 's-inside', 'created'),
    link('t-2', 'transition', 's-inside', 's-outside', 'cancel'),
    link('t-3', 'transition', 's-outside', 's-end', 'closed'),
  ],
};

/** A use case listed right after the boundary stays outside it. */
export const usecaseBoundaryDiagram: DiagramData = {
  id: 'd-usecase', name: 'Boundary', type: 'usecase',
  viewport: { x: 0, y: 0, zoom: 1 },
  elements: [
    element('u-customer', 'actor', '고객'),
    element('u-system', 'system-boundary', 'OrderSystem'),
    element('u-support', 'usecase', 'ContactSupport'),
    element('u-cancel', 'usecase', 'CancelOrder', 'u-system'),
    element('u-refund', 'usecase', 'RefundPayment', 'u-system'),
  ],
  connectors: [
    link('r-1', 'association', 'u-customer', 'u-cancel'),
    link('r-2', 'include', 'u-cancel', 'u-refund'),
    link('r-3', 'extend', 'u-support', 'u-cancel'),
  ],
};

/** Messages stored out of display order; `messageOrder` alone defines it. */
export const reorderedSequenceDiagram: DiagramData = {
  id: 'd-sequence', name: 'Reordered', type: 'sequence',
  viewport: { x: 0, y: 0, zoom: 1 },
  elements: [
    element('l-client', 'lifeline', '고객 Client'),
    element('l-order', 'lifeline', 'OrderService'),
    element('l-payment', 'lifeline', 'PaymentGateway'),
  ],
  connectors: [
    link('m-return', 'return-message', 'l-payment', 'l-order', 'refundAccepted', 3),
    link('m-cancel', 'sync-message', 'l-client', 'l-order', 'cancel(orderId, reason)', 1),
    link('m-refund', 'async-message', 'l-order', 'l-payment', 'refund(orderId) - 결제 취소 요청', 2),
  ],
};
