import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject } from './projectFactory';
import { ProjectSession } from './projectSession';
import { ELEMENT_TYPES, CONNECTOR_TYPES, createCanvasElement, createCanvasConnector } from './elementFactory';
import { ProjectFileSerializer } from '../parser/project/projectFileSerializer';
import { ProjectFileParser } from '../parser/project/projectFileParser';
import { parseDSL } from '../parser/dsl';
import { serializeDSL } from '../parser/dsl/serializer';
import { ExportEngine } from './exportEngine';
import { atomicWrite } from '../../electron/atomicWrite';
import type { DiagramData, DiagramType } from '../types';

afterEach(() => vi.useRealTimers());

describe('Complete project workflow', () => {
  it('undoes pasted elements and their connector as one operation', () => {
    const session = new ProjectSession(createProject('Clipboard'), vi.fn());
    const id = session.addDiagram('Diagram', 'class');
    const a = createCanvasElement('class', 'class', { x: 0, y: 0 }, [])!;
    const b = createCanvasElement('class', 'class', { x: 240, y: 0 }, [a])!;
    const connector = createCanvasConnector('class', 'composition', a.id, b.id)!;
    session.editCanvas(id, { type: 'batch', changes: [{ type: 'element-add', element: a }, { type: 'element-add', element: b }, { type: 'connector-add', connector }] });
    session.undo(id);
    expect(session.project.diagrams[id].elements).toHaveLength(0);
    expect(session.project.diagrams[id].connectors).toHaveLength(0);
    session.redo(id);
    expect(session.project.diagrams[id].elements).toHaveLength(2);
    expect(session.project.diagrams[id].connectors).toHaveLength(1);
  });

  it('creates a blank project, edits a diagram, saves to disk, reopens and exports it', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'uml-workflow-'));
    try {
      const session = new ProjectSession(createProject('주문 프로젝트'), vi.fn());
      expect(Object.keys(session.project.diagrams)).toHaveLength(0);
      const id = session.addDiagram('주문 "생성"', 'class', session.project.tree[0].id);
      const element = createCanvasElement('class', 'class', { x: 50, y: 50 }, [])!;
      session.editCanvas(id, { type: 'element-add', element });
      const snapshot = session.snapshot();
      const file = path.join(directory, 'project.uml.json');
      await atomicWrite(file, ProjectFileSerializer.serialize(snapshot.project));
      session.dispose();
      const parsed = ProjectFileParser.parseAll(await fs.readFile(file, 'utf8'));
      if (!parsed.success) throw new Error(JSON.stringify(parsed.errors));
      const reopened = new ProjectSession(parsed.data, vi.fn());
      expect(reopened.project.metadata.name).toBe('주문 프로젝트');
      expect(reopened.getSession(id)!.sync.getErrors()).toEqual([]);
      expect(reopened.project.diagrams[id].elements[0]).toEqual(element);
      const svg = ExportEngine.exportSVG(reopened.project.diagrams[id]);
      expect(svg).toContain('<svg');
      expect(svg).toContain('NewClass');
      reopened.editCanvas(id, { type: 'element-update', elementId: element.id, properties: { name: 'Renamed' } });
      await atomicWrite(file, ProjectFileSerializer.serialize(reopened.snapshot().project));
      expect(await fs.readFile(file, 'utf8')).toContain('Renamed');
      expect(await fs.readdir(directory)).toEqual(['project.uml.json']);
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
  });

  it('removes nested folder data, drafts, indexes and pending callbacks while keeping other diagrams', () => {
    vi.useFakeTimers();
    const session = new ProjectSession(createProject('Test'), vi.fn());
    const root = session.project.tree[0].id;
    session.setTree([{ ...session.project.tree[0], children: [{ id: 'nested', name: 'Nested', type: 'folder', children: [] }] }]);
    const removed = session.addDiagram('Remove', 'class', 'nested');
    const kept = session.addDiagram('Keep', 'class', root);
    session.editText(removed, '@class-diagram "Pending"\nclass Order {\n}\n');
    session.setTree([{ ...session.project.tree[0], children: session.project.tree[0].children!.filter((node) => node.id !== 'nested') }]);
    vi.runAllTimers();
    const saved = session.snapshot().project;
    expect(saved.diagrams[removed]).toBeUndefined();
    expect(saved.diagramTexts?.[removed]).toBeUndefined();
    expect(saved.metadata.diagramIndex[removed]).toBeUndefined();
    expect(session.getSession(removed)).toBeUndefined();
    expect(saved.diagrams[kept].name).toBe('Keep');
  });

  it('updates parent folder metadata when a diagram is moved', () => {
    const session = new ProjectSession(createProject('Test'), vi.fn());
    const id = session.addDiagram('Move', 'state');
    const node = session.project.tree.find((item) => item.id === id)!;
    session.setTree([{ id: 'destination', name: 'Destination', type: 'folder', children: [node] }]);
    expect(session.project.metadata.diagramIndex[id].parentFolderId).toBe('destination');
    expect(session.project.diagrams[id]).toBeDefined();
  });

  it.each(Object.keys(ELEMENT_TYPES) as DiagramType[])('all %s palette tools survive DSL round trips', (type) => {
    const diagram: DiagramData = { id: 'test', name: '한글 "문서"', type, elements: [], connectors: [], viewport: { x: 0, y: 0, zoom: 1 } };
    for (const elementType of ELEMENT_TYPES[type]) {
      diagram.elements.push(createCanvasElement(type, elementType, { x: diagram.elements.length * 240, y: 0 }, diagram.elements)!);
    }
    if (diagram.elements.length === 1) diagram.elements.push(createCanvasElement(type, ELEMENT_TYPES[type][0], { x: 240, y: 0 }, diagram.elements)!);
    for (const connectorType of CONNECTOR_TYPES[type]) {
      diagram.connectors.push(createCanvasConnector(type, connectorType, diagram.elements[0].id, diagram.elements[1].id)!);
    }
    const parsed = parseDSL(serializeDSL(diagram));
    if (!parsed.success) throw new Error(JSON.stringify(parsed.errors));
    expect(parsed.diagram.name).toBe(diagram.name);
    expect(parsed.diagram.elements).toHaveLength(diagram.elements.length);
    expect(parsed.diagram.connectors).toHaveLength(diagram.connectors.length);
    expect(parsed.diagram.connectors.map((c) => c.type).sort()).toEqual(diagram.connectors.map((c) => c.type).sort());
    const ids = new Set(parsed.diagram.elements.map((element) => element.id));
    for (const connector of parsed.diagram.connectors) {
      expect(ids.has(connector.sourceId)).toBe(true);
      expect(ids.has(connector.targetId)).toBe(true);
    }
    expect(ExportEngine.exportSVG(diagram)).toContain('<svg');
  });
});
