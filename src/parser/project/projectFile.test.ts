import { describe, it, expect } from 'vitest';
import { ProjectFileParser } from './projectFileParser';
import { ProjectFileSerializer } from './projectFileSerializer';
import type {
  ProjectData,
  ProjectMetadata,
  ProjectTreeNode,
  DiagramData,
  DiagramElement,
} from '@/types';

// --- Test fixtures ---

const sampleSharedElement: DiagramElement = {
  id: 'shared-user-class',
  type: 'class',
  position: { x: 100, y: 200 },
  size: { width: 200, height: 150 },
  properties: {
    name: 'User',
    visibility: 'public',
    attributes: [
      { name: 'id', type: 'string', visibility: 'private' },
      { name: 'email', type: 'string', visibility: 'public' },
    ],
    methods: [
      {
        name: 'login',
        returnType: 'boolean',
        parameters: [{ name: 'password', type: 'string' }],
        visibility: 'public',
      },
    ],
  },
};

const sampleDiagram: DiagramData = {
  id: 'diagram-1',
  name: 'Class Diagram - Order',
  type: 'class',
  elements: [
    {
      id: 'el-1',
      type: 'class',
      position: { x: 50, y: 50 },
      size: { width: 180, height: 120 },
      properties: { name: 'Order' },
    },
    {
      id: 'el-2',
      type: 'class',
      position: { x: 300, y: 50 },
      size: { width: 180, height: 120 },
      properties: { name: 'User' },
      sharedRefId: 'shared-user-class',
    },
  ],
  connectors: [
    {
      id: 'conn-1',
      type: 'association',
      sourceId: 'el-1',
      targetId: 'el-2',
      label: 'places',
      properties: { lineStyle: 'solid' },
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1.0 },
};

const sampleDiagram2: DiagramData = {
  id: 'diagram-2',
  name: 'Sequence - Login',
  type: 'sequence',
  elements: [
    {
      id: 'el-3',
      type: 'lifeline',
      position: { x: 100, y: 50 },
      size: { width: 100, height: 400 },
      properties: { name: 'User' },
      sharedRefId: 'shared-user-class',
    },
  ],
  connectors: [],
  viewport: { x: 0, y: 0, zoom: 1.0 },
};

const sampleMetadata: ProjectMetadata = {
  name: 'Test Project',
  version: '1.0.0',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  diagramIndex: {
    'diagram-1': {
      id: 'diagram-1',
      name: 'Class Diagram - Order',
      type: 'class',
      parentFolderId: 'root',
    },
    'diagram-2': {
      id: 'diagram-2',
      name: 'Sequence - Login',
      type: 'sequence',
      parentFolderId: 'root',
    },
  },
};

const sampleTree: ProjectTreeNode[] = [
  {
    id: 'root',
    name: 'Root',
    type: 'folder',
    children: [
      { id: 'diagram-1', name: 'Class Diagram - Order', type: 'diagram', diagramType: 'class' },
      { id: 'diagram-2', name: 'Sequence - Login', type: 'diagram', diagramType: 'sequence' },
    ],
    expanded: true,
  },
];

const sampleProject: ProjectData = {
  metadata: sampleMetadata,
  tree: sampleTree,
  sharedElements: { 'shared-user-class': sampleSharedElement },
  diagrams: { 'diagram-1': sampleDiagram, 'diagram-2': sampleDiagram2 },
};

// --- Tests ---

describe('ProjectFileParser', () => {
  it.each(['null', '[]', '123', '"project"'])('rejects a non-object root without throwing: %s', (json) => {
    expect(ProjectFileParser.parseAll(json).success).toBe(false);
    expect(ProjectFileParser.parseMetadata(json).success).toBe(false);
    expect(ProjectFileParser.parseDiagram(json, 'diagram-1').success).toBe(false);
  });

  it('rejects malformed drafts instead of silently losing them', () => {
    const result = ProjectFileParser.parseAll(JSON.stringify({ ...sampleProject, diagramTexts: { 'diagram-1': null } }));
    expect(result.success).toBe(false);
  });

  it.each([
    { ...sampleDiagram, elements: [null] },
    { ...sampleDiagram, viewport: { x: 0, y: 0, zoom: 0 } },
    { ...sampleDiagram, elements: [{ ...sampleDiagram.elements[0], properties: { name: 'Broken', methods: [{}] } }] },
  ])('rejects malformed diagram data before replacing the current project', (diagram) => {
    const result = ProjectFileParser.parseAll(JSON.stringify({ ...sampleProject, diagrams: { 'diagram-1': diagram } }));
    expect(result.success).toBe(false);
  });

  describe('parseMetadata', () => {
    it('extracts metadata, tree, and sharedElements without diagrams', () => {
      const json = ProjectFileSerializer.serialize(sampleProject);
      const result = ProjectFileParser.parseMetadata(json);

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.metadata).toEqual(sampleMetadata);
      expect(result.data.tree).toEqual(sampleTree);
      expect(result.data.sharedElements).toEqual({ 'shared-user-class': sampleSharedElement });
      // Should NOT include diagrams in the result
      expect((result.data as Record<string, unknown>)['diagrams']).toBeUndefined();
    });

    it('returns error for missing metadata field', () => {
      const json = JSON.stringify({ tree: [], sharedElements: {} });
      const result = ProjectFileParser.parseMetadata(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors.some((e) => e.message.includes('metadata'))).toBe(true);
    });

    it('returns error for missing tree field', () => {
      const json = JSON.stringify({
        metadata: sampleMetadata,
        sharedElements: {},
      });
      const result = ProjectFileParser.parseMetadata(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors.some((e) => e.message.includes('tree'))).toBe(true);
    });

    it('returns error for missing sharedElements field', () => {
      const json = JSON.stringify({
        metadata: sampleMetadata,
        tree: [],
      });
      const result = ProjectFileParser.parseMetadata(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors.some((e) => e.message.includes('sharedElements'))).toBe(true);
    });
  });

  describe('parseDiagram', () => {
    it('extracts a specific diagram by id', () => {
      const json = ProjectFileSerializer.serialize(sampleProject);
      const result = ProjectFileParser.parseDiagram(json, 'diagram-1');

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual(sampleDiagram);
    });

    it('returns error for non-existent diagram id', () => {
      const json = ProjectFileSerializer.serialize(sampleProject);
      const result = ProjectFileParser.parseDiagram(json, 'non-existent');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors[0].message).toContain('non-existent');
    });

    it('returns error when diagrams section is missing', () => {
      const json = JSON.stringify({ metadata: sampleMetadata, tree: [], sharedElements: {} });
      const result = ProjectFileParser.parseDiagram(json, 'diagram-1');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors[0].message).toContain('diagrams');
    });
  });

  describe('parseAll', () => {
    it('returns complete ProjectData', () => {
      const json = ProjectFileSerializer.serialize(sampleProject);
      const result = ProjectFileParser.parseAll(json);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toEqual(sampleProject);
    });

    it('returns error when diagrams field is missing', () => {
      const json = JSON.stringify({
        metadata: sampleMetadata,
        tree: sampleTree,
        sharedElements: {},
      });
      const result = ProjectFileParser.parseAll(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors.some((e) => e.message.includes('diagrams'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns error with position for invalid JSON', () => {
      const badJson = '{ "metadata": invalid }';
      const result = ProjectFileParser.parseAll(badJson);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors[0].message).toContain('Invalid JSON');
      // Position info should be present
      expect(result.errors[0].position).toBeDefined();
    });

    it('returns error for empty string', () => {
      const result = ProjectFileParser.parseAll('');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors[0].message).toContain('Invalid JSON');
    });

    it('returns multiple errors for multiple missing fields', () => {
      const json = JSON.stringify({});
      const result = ProjectFileParser.parseAll(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      // Should report metadata, tree, sharedElements, diagrams as missing
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it('returns errors for missing metadata sub-fields', () => {
      const json = JSON.stringify({
        metadata: { name: 'Test' }, // missing version, createdAt, updatedAt, diagramIndex
        tree: [],
        sharedElements: {},
        diagrams: {},
      });
      const result = ProjectFileParser.parseAll(json);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.errors.some((e) => e.path === 'metadata.version')).toBe(true);
      expect(result.errors.some((e) => e.path === 'metadata.createdAt')).toBe(true);
      expect(result.errors.some((e) => e.path === 'metadata.updatedAt')).toBe(true);
      expect(result.errors.some((e) => e.path === 'metadata.diagramIndex')).toBe(true);
    });
  });
});

describe('ProjectFileSerializer', () => {
  it('produces valid JSON that can be parsed back', () => {
    const json = ProjectFileSerializer.serialize(sampleProject);
    const parsed = JSON.parse(json);

    expect(parsed.metadata).toEqual(sampleProject.metadata);
    expect(parsed.tree).toEqual(sampleProject.tree);
    expect(parsed.sharedElements).toEqual(sampleProject.sharedElements);
    expect(parsed.diagrams).toEqual(sampleProject.diagrams);
  });

  it('preserves shared element references through serialize → parse roundtrip', () => {
    const json = ProjectFileSerializer.serialize(sampleProject);
    const result = ProjectFileParser.parseAll(json);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Shared element in registry
    const sharedEl = result.data.sharedElements['shared-user-class'];
    expect(sharedEl).toBeDefined();
    expect(sharedEl.properties.name).toBe('User');

    // Element in diagram-1 references the shared element
    const d1El = result.data.diagrams['diagram-1'].elements.find(
      (e) => e.sharedRefId === 'shared-user-class',
    );
    expect(d1El).toBeDefined();
    expect(d1El!.sharedRefId).toBe('shared-user-class');

    // Element in diagram-2 also references the same shared element
    const d2El = result.data.diagrams['diagram-2'].elements.find(
      (e) => e.sharedRefId === 'shared-user-class',
    );
    expect(d2El).toBeDefined();
    expect(d2El!.sharedRefId).toBe('shared-user-class');
  });
});
