import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConnectorPanel } from './ConnectorPanel';
import type { Connector, DiagramElement } from '../../types';

const el = (id: string, name: string): DiagramElement => ({
  id, type: 'class', position: { x: 0, y: 0 }, size: { width: 100, height: 80 }, properties: { name },
});
const elements = [el('a', 'Customer'), el('b', 'Order')];
const connector: Connector = { id: 'c', type: 'association', sourceId: 'a', targetId: 'b', label: 'places', properties: {} };

describe('A05.04 connector panel', () => {
  const html = renderToStaticMarkup(createElement(ConnectorPanel, { connector, elements, diagramType: 'class', onConnectorChange: () => null }));

  it('shows the direction by element name and offers both ends', () => {
    expect(html).toContain('Customer → Order (association)');
    expect(html).toMatch(/<select id="connector-source"[^>]*>.*<option value="a" selected="">Customer<\/option>/);
    expect(html).toMatch(/<select id="connector-target"[^>]*>.*<option value="b" selected="">Order<\/option>/);
    expect(html).toContain('value="places"');
  });

  it('starts clean with Apply and Cancel disabled', () => {
    expect(html).toMatch(/<button class="panel-button" disabled="">Apply<\/button>/);
    expect(html).toMatch(/<button class="panel-button" disabled="">Cancel<\/button>/);
  });

  it('locks while the DSL has errors', () => {
    const locked = renderToStaticMarkup(createElement(ConnectorPanel, { connector, elements, diagramType: 'class', onConnectorChange: () => null, disabled: true }));
    expect(locked).toContain('Fix the DSL errors to edit connections.');
    expect(locked).toContain('<fieldset class="property-body" disabled=""');
  });

  it('offers multiplicity fields only for class relationships that can count', () => {
    const render = (type: Connector['type'], diagramType: 'class' | 'usecase') => renderToStaticMarkup(createElement(ConnectorPanel, {
      connector: { ...connector, type }, elements, diagramType, onConnectorChange: () => null,
    }));
    for (const type of ['association', 'directed-association', 'aggregation', 'composition'] as const) {
      expect(render(type, 'class')).toContain('connector-source-multiplicity');
    }
    for (const type of ['inheritance', 'realization', 'dependency', 'usage'] as const) {
      expect(render(type, 'class')).not.toContain('multiplicity');
    }
    expect(render('association', 'usecase')).not.toContain('multiplicity');
  });

  it('shows the stored multiplicities', () => {
    const html = renderToStaticMarkup(createElement(ConnectorPanel, {
      connector: { ...connector, sourceMultiplicity: '1', targetMultiplicity: '0..*' }, elements, diagramType: 'class', onConnectorChange: () => null,
    }));
    expect(html).toContain('id="connector-source-multiplicity"');
    expect(html).toContain('value="0..*"');
  });
});

describe('A05.06 message order control', () => {
  const lifelines = [{ ...el('a', 'Client'), type: 'lifeline' as const }, { ...el('b', 'Order'), type: 'lifeline' as const }];
  const message = (messageOrder: number): Connector => ({ id: 'm', type: 'sync-message', sourceId: 'a', targetId: 'b', label: 'place', messageOrder, properties: {} });
  const render = (connector: Connector, messageCount: number) => renderToStaticMarkup(createElement(ConnectorPanel, {
    connector, elements: lifelines, diagramType: 'sequence', messageCount, onConnectorChange: () => null,
  }));

  it('shows the position of a message among all messages', () => {
    expect(render(message(2), 3)).toContain('Order 2 of 3');
    expect(render(message(2), 3)).toMatch(/<button class="panel-button">Move earlier<\/button><button class="panel-button">Move later<\/button>/);
  });

  it('cannot move the first message earlier or the last one later', () => {
    expect(render(message(1), 3)).toMatch(/disabled="">Move earlier/);
    expect(render(message(3), 3)).toMatch(/disabled="">Move later/);
  });

  it('offers no reorder control for connectors that are not messages', () => {
    const association = renderToStaticMarkup(createElement(ConnectorPanel, { connector, elements, diagramType: 'class', messageCount: 3, onConnectorChange: () => null }));
    expect(association).not.toContain('Message order');
  });
});
