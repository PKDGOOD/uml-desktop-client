import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PropertyPanel } from './PropertyPanel';
import type { DiagramElement } from '../../types';

const element: DiagramElement = {
  id: 'e', type: 'class', position: { x: 0, y: 0 }, size: { width: 100, height: 80 },
  properties: { name: 'Order', attributes: [{ name: 'id', type: 'String', visibility: 'private' }] },
};

describe('A04.09 property panel while the DSL has errors', () => {
  it('disables every field and says why', () => {
    const html = renderToStaticMarkup(createElement(PropertyPanel, { element, onPropertyChange: () => {}, disabled: true }));
    expect(html).toContain('<fieldset class="property-body" disabled=""');
    expect(html).toContain('Fix the DSL errors to edit properties.');
  });

  it('leaves fields editable otherwise', () => {
    const html = renderToStaticMarkup(createElement(PropertyPanel, { element, onPropertyChange: () => {} }));
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('Fix the DSL errors');
  });
});
