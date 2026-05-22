import { describe, expect, it } from 'vitest';
import { createCanvasConnector, createCanvasElement } from './elementFactory';
import type { DiagramElement } from '../types';

function makeElement(name: string): DiagramElement {
  return {
    id: name,
    type: 'class',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 80 },
    properties: { name },
  };
}

describe('createCanvasElement', () => {
  it('creates serializable class diagram elements at the requested position', () => {
    const element = createCanvasElement('class', 'interface', { x: 40, y: 60 }, []);

    expect(element).toMatchObject({
      type: 'interface',
      position: { x: 40, y: 60 },
      size: { width: 200, height: 150 },
      properties: { name: 'NewInterface', attributes: [], methods: [] },
    });
  });

  it('chooses the next available default name', () => {
    const element = createCanvasElement(
      'class',
      'class',
      { x: 0, y: 0 },
      [makeElement('NewClass'), makeElement('NewClass2')],
    );

    expect(element?.properties.name).toBe('NewClass3');
  });

  it('does not create unsupported diagram elements yet', () => {
    expect(createCanvasElement('class', 'note', { x: 0, y: 0 }, [])).toBeNull();
    expect(createCanvasElement('sequence', 'lifeline', { x: 0, y: 0 }, [])).toBeNull();
  });
});

describe('createCanvasConnector', () => {
  it('creates class diagram connector data for two different elements', () => {
    expect(createCanvasConnector('class', 'inheritance', 'child', 'parent')).toMatchObject({
      type: 'inheritance',
      sourceId: 'child',
      targetId: 'parent',
      properties: {},
    });
  });

  it('rejects self links and unsupported connector flows', () => {
    expect(createCanvasConnector('class', 'dependency', 'a', 'a')).toBeNull();
    expect(createCanvasConnector('sequence', 'sync-message', 'a', 'b')).toBeNull();
  });
});
