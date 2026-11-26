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
    expect(html).not.toContain('<fieldset class="property-body" disabled');
    expect(html).not.toContain('Fix the DSL errors');
  });

  it('starts clean: Apply and Cancel are disabled until something is typed', () => {
    const html = renderToStaticMarkup(createElement(PropertyPanel, { element, onPropertyChange: () => {} }));
    expect(html).toMatch(/<button class="panel-button" disabled="">Apply<\/button>/);
    expect(html).toMatch(/<button class="panel-button" disabled="">Cancel<\/button>/);
  });
});

describe('A05.07 parent field', () => {
  const state: DiagramElement = { id: 's', type: 'state', position: { x: 0, y: 0 }, size: { width: 100, height: 60 }, properties: { name: 'Idle' } };
  const options = [{ id: 'c1', name: 'Active' }, { id: 'c2', name: 'Spare' }];

  it('offers top level and every allowed container, with the current parent selected', () => {
    const html = renderToStaticMarkup(createElement(PropertyPanel, { element: { ...state, parentId: 'c2' }, onPropertyChange: () => {}, parentOptions: options, onParentChange: () => null }));
    expect(html).toContain('<label class="field-label" for="element-parent">Inside</label>');
    expect(html).toMatch(/<option value="">\(top level\)<\/option><option value="c1">Active<\/option><option value="c2" selected="">Spare<\/option>/);
  });

  it('is hidden when the element has no parent and no container could take it', () => {
    const html = renderToStaticMarkup(createElement(PropertyPanel, { element, onPropertyChange: () => {}, parentOptions: [], onParentChange: () => null }));
    expect(html).not.toContain('element-parent');
  });
});
