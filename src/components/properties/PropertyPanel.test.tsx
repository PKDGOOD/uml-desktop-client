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

describe('A05.07 parent choice', () => {
  const state: DiagramElement = { id: 's', type: 'state', position: { x: 0, y: 0 }, size: { width: 80, height: 40 }, properties: { name: 'Idle' } };
  const render = (owner?: { parentId: string | null; choices: { id: string; name: string }[] }) => renderToStaticMarkup(
    createElement(PropertyPanel, { element: state, onPropertyChange: () => null, owner, onParentChange: () => null }),
  );

  it('lists the valid owners with the current one selected', () => {
    const html = render({ parentId: 'c1', choices: [{ id: 'c1', name: 'Active' }, { id: 'c2', name: 'Other' }] });
    expect(html).toContain('<option value="">(none, top level)</option>');
    expect(html).toMatch(/<option value="c1" selected="">Active<\/option>/);
    expect(html).toContain('<option value="c2">Other</option>');
  });

  it('is left out when the element has no owner and none could own it', () => {
    expect(render({ parentId: null, choices: [] })).not.toContain('element-parent');
    expect(render(undefined)).not.toContain('element-parent');
  });
});
