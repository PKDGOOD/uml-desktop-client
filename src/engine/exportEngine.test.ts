import { expect, it } from 'vitest';
import { ExportEngine } from './exportEngine';
import { connectorGeometry } from './connectorGeometry';
import type { DiagramData } from '../types';

const diagram: DiagramData = {
  id: 'diagram', name: 'Export', type: 'class', viewport: { x: 0, y: 0, zoom: 1 },
  elements: ['a', 'b'].map((id, i) => ({ id, type: 'class', position: { x: i * 300, y: 0 }, size: { width: 100, height: 100 }, properties: { name: id } })),
  connectors: [{ id: 'link', type: 'composition', sourceId: 'a', targetId: 'b', properties: {} }],
};

it('draws connectors at shape edges and uses a source diamond for composition', () => {
  expect(connectorGeometry(diagram.connectors[0], diagram.elements)).toMatchObject({ source: { x: 100, y: 50 }, target: { x: 300, y: 50 } });
  const svg = ExportEngine.exportSVG(diagram);
  expect(svg).toContain('marker-start="url(#composition)"');
  expect(svg).toContain('points="120,70 320,70"');
});

it('escapes user-controlled SVG labels', () => {
  const svg = ExportEngine.exportSVG({ ...diagram, elements: [{ ...diagram.elements[0], properties: { name: '<script>alert(1)</script>' } }] });
  expect(svg).not.toContain('<script>');
  expect(svg).toContain('&lt;script&gt;');
});

it('includes manually routed waypoints in export bounds', () => {
  const svg = ExportEngine.exportSVG({ ...diagram, connectors: [{ ...diagram.connectors[0], waypoints: [{ x: -200, y: 500 }] }] });
  expect(svg).toContain('width="640" height="540"');
});

it('places sequence messages on separate rows', () => {
  const first = connectorGeometry(diagram.connectors[0], diagram.elements, 0)!;
  const second = connectorGeometry(diagram.connectors[0], diagram.elements, 1)!;
  expect(second.source.y).toBeGreaterThan(first.source.y);
  expect(first.source.y).toBe(first.target.y);
});
