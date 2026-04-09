import { describe, it, expect } from 'vitest';
import type {
  DiagramType,
  Position,
  Size,
  Viewport,
  Attribute,
  Parameter,
  Method,
  ElementProperties,
  ElementType,
  DiagramElement,
  ConnectorType,
  ConnectorProperties,
  Connector,
  DiagramData,
  DiagramMeta,
  ProjectMetadata,
  ProjectTreeNode,
  ProjectData,
  DSLParseResult,
  DSLError,
  ExportOptions,
  Command,
  Snapshot,
  SnapshotEntry,
  DiffResult,
  DiffEntry,
  ElementChange,
  TextDiff,
  DiffHunk,
  DiffLine,
  CanvasChange,
} from './index';

describe('Core Data Model Types', () => {
  it('should create a valid DiagramElement', () => {
    const element: DiagramElement = {
      id: 'e1',
      type: 'class',
      position: { x: 10, y: 20 },
      size: { width: 200, height: 150 },
      properties: {
        name: 'Order',
        visibility: 'public',
        attributes: [
          { name: 'id', type: 'string', visibility: 'private' },
        ],
        methods: [
          {
            name: 'getTotal',
            returnType: 'number',
            parameters: [],
            visibility: 'public',
          },
        ],
      },
    };
    expect(element.id).toBe('e1');
    expect(element.type).toBe('class');
    expect(element.properties.attributes).toHaveLength(1);
    expect(element.properties.methods).toHaveLength(1);
  });

  it('should create a valid Connector', () => {
    const connector: Connector = {
      id: 'c1',
      type: 'association',
      sourceId: 'e1',
      targetId: 'e2',
      label: 'uses',
      sourceMultiplicity: '1',
      targetMultiplicity: '*',
      properties: { lineStyle: 'solid', arrowStyle: 'open' },
    };
    expect(connector.type).toBe('association');
    expect(connector.sourceId).toBe('e1');
  });

  it('should create a valid DiagramData', () => {
    const diagram: DiagramData = {
      id: 'd1',
      name: 'Class Diagram',
      type: 'class',
      elements: [],
      connectors: [],
      viewport: { x: 0, y: 0, zoom: 1.0 },
    };
    expect(diagram.type).toBe('class');
    expect(diagram.viewport.zoom).toBe(1.0);
  });

  it('should create a valid ProjectData', () => {
    const project: ProjectData = {
      metadata: {
        name: 'Test Project',
        version: '1.0.0',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
        diagramIndex: {
          d1: { id: 'd1', name: 'Class Diagram', type: 'class', parentFolderId: 'root' },
        },
      },
      tree: [
        { id: 'root', name: 'Root', type: 'folder', children: [
          { id: 'd1', name: 'Class Diagram', type: 'diagram', diagramType: 'class' },
        ]},
      ],
      sharedElements: {},
      diagrams: {},
    };
    expect(project.metadata.name).toBe('Test Project');
    expect(project.tree).toHaveLength(1);
    expect(project.tree[0].children).toHaveLength(1);
  });

  it('should create valid DSLParseResult for success', () => {
    const result: DSLParseResult = {
      success: true,
      diagram: {
        id: 'd1',
        name: 'Test',
        type: 'class',
        elements: [],
        connectors: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };
    expect(result.success).toBe(true);
  });

  it('should create valid DSLParseResult for failure', () => {
    const result: DSLParseResult = {
      success: false,
      errors: [
        { line: 1, column: 5, message: 'Unexpected token', expected: ['class', 'interface'] },
      ],
    };
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].line).toBe(1);
    }
  });

  it('should create valid ExportOptions', () => {
    const options: ExportOptions = {
      scale: 2,
      backgroundColor: '#ffffff',
      padding: 20,
    };
    expect(options.scale).toBe(2);
  });

  it('should create valid Snapshot and SnapshotEntry', () => {
    const snapshot: Snapshot = {
      id: 'snap-001',
      createdAt: new Date('2024-01-01'),
      message: 'Initial snapshot',
      projectDataPath: '.versions/snap-001',
    };
    expect(snapshot.id).toBe('snap-001');

    const entry: SnapshotEntry = {
      id: 'snap-001',
      createdAt: '2024-01-01T00:00:00Z',
      message: 'Initial snapshot',
      path: '.versions/snap-001',
    };
    expect(entry.path).toBe('.versions/snap-001');
  });

  it('should create valid DiffResult', () => {
    const diff: DiffResult = {
      added: [{ diagramId: 'd2', diagramName: 'New Diagram', elementChanges: [] }],
      modified: [],
      deleted: [],
      dslTextDiff: [
        {
          diagramId: 'd1',
          diagramName: 'Class Diagram',
          hunks: [
            {
              oldStart: 1,
              oldLines: 3,
              newStart: 1,
              newLines: 4,
              lines: [
                { type: 'context', content: 'class Order {' },
                { type: 'add', content: '  - status: string' },
                { type: 'context', content: '}' },
              ],
            },
          ],
        },
      ],
    };
    expect(diff.added).toHaveLength(1);
    expect(diff.dslTextDiff[0].hunks[0].lines).toHaveLength(3);
  });

  it('should create valid CanvasChange variants', () => {
    const addChange: CanvasChange = {
      type: 'element-add',
      element: {
        id: 'e1',
        type: 'class',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        properties: { name: 'Foo' },
      },
    };
    expect(addChange.type).toBe('element-add');

    const moveChange: CanvasChange = {
      type: 'element-move',
      elementId: 'e1',
      position: { x: 50, y: 50 },
    };
    expect(moveChange.type).toBe('element-move');

    const deleteChange: CanvasChange = {
      type: 'element-delete',
      elementId: 'e1',
    };
    expect(deleteChange.type).toBe('element-delete');

    const connectorAdd: CanvasChange = {
      type: 'connector-add',
      connector: {
        id: 'c1',
        type: 'inheritance',
        sourceId: 'e1',
        targetId: 'e2',
        properties: {},
      },
    };
    expect(connectorAdd.type).toBe('connector-add');
  });

  it('should support all DiagramType values', () => {
    const types: DiagramType[] = ['class', 'sequence', 'usecase', 'activity', 'state'];
    expect(types).toHaveLength(5);
  });

  it('should support shared element references', () => {
    const sharedElement: DiagramElement = {
      id: 'e1',
      type: 'class',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 80 },
      properties: { name: 'SharedClass' },
      sharedRefId: 'shared-001',
    };
    expect(sharedElement.sharedRefId).toBe('shared-001');
  });
});
