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
  const html = renderToStaticMarkup(createElement(ConnectorPanel, { connector, elements, onConnectorChange: () => null }));

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
    const locked = renderToStaticMarkup(createElement(ConnectorPanel, { connector, elements, onConnectorChange: () => null, disabled: true }));
    expect(locked).toContain('Fix the DSL errors to edit connections.');
    expect(locked).toContain('<fieldset class="property-body" disabled=""');
  });
});
