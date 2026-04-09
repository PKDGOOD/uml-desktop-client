import { describe, it, expect, beforeEach } from 'vitest';
import { ClipboardManager } from './clipboardManager';
import type { DiagramElement, Connector } from '../types';

function makeElement(id: string, x: number, y: number, name = 'Element'): DiagramElement {
  return {
    id,
    type: 'class',
    position: { x, y },
    size: { width: 100, height: 80 },
    properties: { name },
  };
}

function makeConnector(id: string, sourceId: string, targetId: string): Connector {
  return {
    id,
    type: 'association',
    sourceId,
    targetId,
    properties: {},
  };
}

describe('ClipboardManager', () => {
  let clipboard: ClipboardManager;

  beforeEach(() => {
    clipboard = new ClipboardManager();
  });

  describe('hasContent()', () => {
    it('returns false when clipboard is empty', () => {
      expect(clipboard.hasContent()).toBe(false);
    });

    it('returns true after copy', () => {
      clipboard.copy([makeElement('e1', 10, 20)], []);
      expect(clipboard.hasContent()).toBe(true);
    });

    it('returns true after cut', () => {
      clipboard.cut([makeElement('e1', 10, 20)], []);
      expect(clipboard.hasContent()).toBe(true);
    });

    it('returns false when copying empty elements array', () => {
      clipboard.copy([], []);
      expect(clipboard.hasContent()).toBe(false);
    });
  });

  describe('copy()', () => {
    it('stores deep clones of elements', () => {
      const el = makeElement('e1', 10, 20, 'MyClass');
      clipboard.copy([el], []);

      // Mutate original - should not affect clipboard
      el.properties.name = 'Changed';

      const result = clipboard.paste({ x: 10, y: 20 });
      expect(result.elements[0].properties.name).toBe('MyClass');
    });

    it('stores deep clones of connectors', () => {
      const el1 = makeElement('e1', 0, 0);
      const el2 = makeElement('e2', 100, 0);
      const conn = makeConnector('c1', 'e1', 'e2');
      clipboard.copy([el1, el2], [conn]);

      conn.label = 'mutated';

      const result = clipboard.paste({ x: 0, y: 0 });
      expect(result.connectors[0].label).toBeUndefined();
    });
  });

  describe('cut()', () => {
    it('returns the elements passed in for removal', () => {
      const el = makeElement('e1', 10, 20);
      const returned = clipboard.cut([el], []);
      expect(returned).toEqual([el]);
    });

    it('stores content in clipboard for paste', () => {
      clipboard.cut([makeElement('e1', 10, 20)], []);
      expect(clipboard.hasContent()).toBe(true);
    });

    it('exposes cut elements via getCutElements()', () => {
      const el = makeElement('e1', 10, 20);
      clipboard.cut([el], []);
      expect(clipboard.getCutElements()).toEqual([el]);
    });

    it('clears cutElements after copy', () => {
      clipboard.cut([makeElement('e1', 10, 20)], []);
      clipboard.copy([makeElement('e2', 30, 40)], []);
      expect(clipboard.getCutElements()).toBeNull();
    });
  });

  describe('paste()', () => {
    it('returns empty arrays when clipboard is empty', () => {
      const result = clipboard.paste({ x: 0, y: 0 });
      expect(result.elements).toEqual([]);
      expect(result.connectors).toEqual([]);
    });

    it('generates new unique IDs for pasted elements', () => {
      const el = makeElement('e1', 0, 0);
      clipboard.copy([el], []);

      const result = clipboard.paste({ x: 0, y: 0 });
      expect(result.elements).toHaveLength(1);
      expect(result.elements[0].id).not.toBe('e1');
    });

    it('preserves original properties on pasted elements', () => {
      const el = makeElement('e1', 0, 0, 'OrderClass');
      el.properties.visibility = 'private';
      el.properties.attributes = [{ name: 'id', type: 'string', visibility: 'private' }];
      clipboard.copy([el], []);

      const result = clipboard.paste({ x: 50, y: 50 });
      const pasted = result.elements[0];
      expect(pasted.properties.name).toBe('OrderClass');
      expect(pasted.properties.visibility).toBe('private');
      expect(pasted.properties.attributes).toEqual([{ name: 'id', type: 'string', visibility: 'private' }]);
      expect(pasted.size).toEqual({ width: 100, height: 80 });
      expect(pasted.type).toBe('class');
    });

    it('offsets element positions relative to targetPosition', () => {
      const el1 = makeElement('e1', 10, 20);
      const el2 = makeElement('e2', 50, 60);
      clipboard.copy([el1, el2], []);

      const result = clipboard.paste({ x: 100, y: 200 });
      // min position is (10, 20), offset = (90, 180)
      expect(result.elements[0].position).toEqual({ x: 100, y: 200 });
      expect(result.elements[1].position).toEqual({ x: 140, y: 240 });
    });

    it('rebuilds connector relationships with new IDs', () => {
      const el1 = makeElement('e1', 0, 0);
      const el2 = makeElement('e2', 100, 0);
      const conn = makeConnector('c1', 'e1', 'e2');
      clipboard.copy([el1, el2], [conn]);

      const result = clipboard.paste({ x: 0, y: 0 });
      expect(result.connectors).toHaveLength(1);

      const pastedConn = result.connectors[0];
      expect(pastedConn.id).not.toBe('c1');
      expect(pastedConn.sourceId).toBe(result.elements[0].id);
      expect(pastedConn.targetId).toBe(result.elements[1].id);
      expect(pastedConn.type).toBe('association');
    });

    it('drops connectors referencing elements not in the pasted set', () => {
      const el1 = makeElement('e1', 0, 0);
      // Connector references e1 and e3, but e3 is not copied
      const conn = makeConnector('c1', 'e1', 'e3');
      clipboard.copy([el1], [conn]);

      const result = clipboard.paste({ x: 0, y: 0 });
      expect(result.connectors).toHaveLength(0);
    });

    it('can paste multiple times from the same copy', () => {
      const el = makeElement('e1', 0, 0);
      clipboard.copy([el], []);

      const r1 = clipboard.paste({ x: 10, y: 10 });
      const r2 = clipboard.paste({ x: 20, y: 20 });

      expect(r1.elements[0].id).not.toBe(r2.elements[0].id);
      expect(r1.elements[0].position).toEqual({ x: 10, y: 10 });
      expect(r2.elements[0].position).toEqual({ x: 20, y: 20 });
    });

    it('preserves connector properties (label, multiplicity, waypoints)', () => {
      const el1 = makeElement('e1', 0, 0);
      const el2 = makeElement('e2', 100, 0);
      const conn: Connector = {
        id: 'c1',
        type: 'composition',
        sourceId: 'e1',
        targetId: 'e2',
        label: 'contains',
        sourceMultiplicity: '1',
        targetMultiplicity: '*',
        waypoints: [{ x: 50, y: 25 }],
        properties: { lineStyle: 'solid', arrowStyle: 'diamond-filled' },
      };
      clipboard.copy([el1, el2], [conn]);

      const result = clipboard.paste({ x: 0, y: 0 });
      const pasted = result.connectors[0];
      expect(pasted.type).toBe('composition');
      expect(pasted.label).toBe('contains');
      expect(pasted.sourceMultiplicity).toBe('1');
      expect(pasted.targetMultiplicity).toBe('*');
      expect(pasted.waypoints).toEqual([{ x: 50, y: 25 }]);
      expect(pasted.properties.lineStyle).toBe('solid');
      expect(pasted.properties.arrowStyle).toBe('diamond-filled');
    });
  });
});
