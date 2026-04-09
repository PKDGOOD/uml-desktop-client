// =============================================================================
// App - Main application component integrating all UI and engine components
// =============================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useProjectStore } from './store/projectStore';
import { useDiagramStore } from './store/diagramStore';
import { ProjectTree } from './components/project/ProjectTree';
import { DiagramTabs, type DiagramTabInfo } from './components/tabs/DiagramTabs';
import { SplitView } from './components/layout/SplitView';
import { PropertyPanel } from './components/properties/PropertyPanel';
import { Toolbar } from './components/toolbar/Toolbar';
import { UMLCanvas } from './components/canvas/UMLCanvas';
import { DSLEditor } from './components/editor/DSLEditor';
import { SyncEngine } from './engine/syncEngine';
import { UndoManager } from './engine/undoManager';
import { serializeDSL } from './parser/dsl/serializer';
import { ProjectFileSerializer } from './parser/project/projectFileSerializer';
import { ProjectFileParser } from './parser/project/projectFileParser';
import type {
  ProjectData,
  ProjectTreeNode,
  DiagramType,
  ElementType,
  DiagramElement,
  ElementProperties,
  DiagramData,
  CanvasChange,
  DSLError,
} from './types';

// =============================================================================
// Electron API type (exposed via preload)
// =============================================================================

interface ElectronAPI {
  saveProject(filePath: string, data: string): Promise<void>;
  loadProject(filePath: string): Promise<string>;
  showSaveDialog(options: {
    title?: string;
    defaultPath?: string;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<string | null>;
  showOpenDialog(options: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
    properties?: string[];
  }): Promise<string | null>;
  getRecentProjects(): Promise<string[]>;
  addRecentProject(path: string): Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// =============================================================================
// Helper: create empty project
// =============================================================================

function createEmptyProject(name: string): ProjectData {
  const now = new Date().toISOString();

  // --- 1. Class Diagram: Order System ---
  const classDiag: DiagramData = {
    id: 'diag-class',
    name: 'Class - Order System',
    type: 'class',
    elements: [
      { id: 'c-order', type: 'class', position: { x: 50, y: 50 }, size: { width: 220, height: 160 }, properties: { name: 'Order', attributes: [{ name: 'id', type: 'string', visibility: 'private' as const }, { name: 'status', type: 'OrderStatus', visibility: 'private' as const }, { name: 'createdAt', type: 'Date', visibility: 'private' as const }], methods: [{ name: 'addItem', returnType: 'void', parameters: [{ name: 'item', type: 'OrderItem' }], visibility: 'public' as const }, { name: 'calculateTotal', returnType: 'number', parameters: [], visibility: 'public' as const }] } },
      { id: 'c-item', type: 'class', position: { x: 350, y: 50 }, size: { width: 200, height: 120 }, properties: { name: 'OrderItem', attributes: [{ name: 'quantity', type: 'number', visibility: 'private' as const }, { name: 'unitPrice', type: 'number', visibility: 'private' as const }], methods: [{ name: 'getSubtotal', returnType: 'number', parameters: [], visibility: 'public' as const }] } },
      { id: 'c-customer', type: 'class', position: { x: 50, y: 280 }, size: { width: 200, height: 120 }, properties: { name: 'Customer', attributes: [{ name: 'name', type: 'string', visibility: 'private' as const }, { name: 'email', type: 'string', visibility: 'private' as const }], methods: [{ name: 'placeOrder', returnType: 'Order', parameters: [], visibility: 'public' as const }] } },
      { id: 'c-product', type: 'class', position: { x: 350, y: 280 }, size: { width: 200, height: 110 }, properties: { name: 'Product', attributes: [{ name: 'name', type: 'string', visibility: 'private' as const }, { name: 'price', type: 'number', visibility: 'private' as const }, { name: 'stock', type: 'number', visibility: 'private' as const }], methods: [] } },
      { id: 'c-payment', type: 'interface', position: { x: 620, y: 50 }, size: { width: 200, height: 100 }, properties: { name: 'PaymentGateway', attributes: [], methods: [{ name: 'charge', returnType: 'boolean', parameters: [{ name: 'amount', type: 'number' }], visibility: 'public' as const }] } },
      { id: 'c-status', type: 'enum', position: { x: 620, y: 200 }, size: { width: 160, height: 120 }, properties: { name: 'OrderStatus', attributes: [{ name: 'PENDING', type: '', visibility: 'public' as const }, { name: 'CONFIRMED', type: '', visibility: 'public' as const }, { name: 'SHIPPED', type: '', visibility: 'public' as const }, { name: 'CANCELLED', type: '', visibility: 'public' as const }], methods: [] } },
    ],
    connectors: [
      { id: 'cc1', type: 'composition', sourceId: 'c-order', targetId: 'c-item', sourceMultiplicity: '1', targetMultiplicity: '*', label: 'contains', properties: {} },
      { id: 'cc2', type: 'directed-association', sourceId: 'c-customer', targetId: 'c-order', sourceMultiplicity: '1', targetMultiplicity: '*', label: 'places', properties: {} },
      { id: 'cc3', type: 'directed-association', sourceId: 'c-item', targetId: 'c-product', label: 'references', properties: {} },
      { id: 'cc4', type: 'dependency', sourceId: 'c-order', targetId: 'c-status', properties: {} },
      { id: 'cc5', type: 'dependency', sourceId: 'c-order', targetId: 'c-payment', label: 'uses', properties: {} },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  // --- 2. Sequence Diagram: Checkout Flow ---
  const seqDiag: DiagramData = {
    id: 'diag-sequence',
    name: 'Sequence - Checkout Flow',
    type: 'sequence',
    elements: [
      { id: 's-user', type: 'lifeline', position: { x: 50, y: 50 }, size: { width: 120, height: 400 }, properties: { name: 'Customer' } },
      { id: 's-cart', type: 'lifeline', position: { x: 250, y: 50 }, size: { width: 120, height: 400 }, properties: { name: 'ShoppingCart' } },
      { id: 's-order', type: 'lifeline', position: { x: 450, y: 50 }, size: { width: 120, height: 400 }, properties: { name: 'OrderService' } },
      { id: 's-pay', type: 'lifeline', position: { x: 650, y: 50 }, size: { width: 120, height: 400 }, properties: { name: 'PaymentGateway' } },
    ],
    connectors: [
      { id: 'sc1', type: 'sync-message', sourceId: 's-user', targetId: 's-cart', label: 'addItem(product, qty)', properties: {} },
      { id: 'sc2', type: 'sync-message', sourceId: 's-user', targetId: 's-cart', label: 'checkout()', properties: {} },
      { id: 'sc3', type: 'sync-message', sourceId: 's-cart', targetId: 's-order', label: 'createOrder(items)', properties: {} },
      { id: 'sc4', type: 'sync-message', sourceId: 's-order', targetId: 's-pay', label: 'charge(total)', properties: {} },
      { id: 'sc5', type: 'return-message', sourceId: 's-pay', targetId: 's-order', label: 'paymentResult', properties: {} },
      { id: 'sc6', type: 'return-message', sourceId: 's-order', targetId: 's-cart', label: 'orderConfirmation', properties: {} },
      { id: 'sc7', type: 'return-message', sourceId: 's-cart', targetId: 's-user', label: 'receipt', properties: {} },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  // --- 3. Use Case Diagram: Shopping System ---
  const ucDiag: DiagramData = {
    id: 'diag-usecase',
    name: 'UseCase - Shopping System',
    type: 'usecase',
    elements: [
      { id: 'u-customer', type: 'actor', position: { x: 30, y: 100 }, size: { width: 60, height: 100 }, properties: { name: 'Customer' } },
      { id: 'u-admin', type: 'actor', position: { x: 30, y: 320 }, size: { width: 60, height: 100 }, properties: { name: 'Admin' } },
      { id: 'u-browse', type: 'usecase', position: { x: 220, y: 30 }, size: { width: 170, height: 60 }, properties: { name: 'Browse Products' } },
      { id: 'u-order', type: 'usecase', position: { x: 220, y: 120 }, size: { width: 170, height: 60 }, properties: { name: 'Place Order' } },
      { id: 'u-pay', type: 'usecase', position: { x: 220, y: 210 }, size: { width: 170, height: 60 }, properties: { name: 'Make Payment' } },
      { id: 'u-track', type: 'usecase', position: { x: 220, y: 300 }, size: { width: 170, height: 60 }, properties: { name: 'Track Order' } },
      { id: 'u-manage', type: 'usecase', position: { x: 220, y: 390 }, size: { width: 170, height: 60 }, properties: { name: 'Manage Inventory' } },
    ],
    connectors: [
      { id: 'uc1', type: 'directed-association', sourceId: 'u-customer', targetId: 'u-browse', properties: {} },
      { id: 'uc2', type: 'directed-association', sourceId: 'u-customer', targetId: 'u-order', properties: {} },
      { id: 'uc3', type: 'directed-association', sourceId: 'u-customer', targetId: 'u-track', properties: {} },
      { id: 'uc4', type: 'directed-association', sourceId: 'u-admin', targetId: 'u-manage', properties: {} },
      { id: 'uc5', type: 'include', sourceId: 'u-order', targetId: 'u-pay', properties: {} },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  // --- 4. Activity Diagram: Order Processing ---
  const actDiag: DiagramData = {
    id: 'diag-activity',
    name: 'Activity - Order Processing',
    type: 'activity',
    elements: [
      { id: 'a-start', type: 'initial-node', position: { x: 250, y: 10 }, size: { width: 30, height: 30 }, properties: { name: 'start' } },
      { id: 'a-receive', type: 'action', position: { x: 185, y: 70 }, size: { width: 160, height: 50 }, properties: { name: 'Receive Order' } },
      { id: 'a-validate', type: 'action', position: { x: 185, y: 150 }, size: { width: 160, height: 50 }, properties: { name: 'Validate Payment' } },
      { id: 'a-decision', type: 'decision', position: { x: 225, y: 230 }, size: { width: 80, height: 80 }, properties: { name: 'Payment Valid?' } },
      { id: 'a-process', type: 'action', position: { x: 100, y: 340 }, size: { width: 160, height: 50 }, properties: { name: 'Process Order' } },
      { id: 'a-reject', type: 'action', position: { x: 350, y: 340 }, size: { width: 160, height: 50 }, properties: { name: 'Reject Order' } },
      { id: 'a-fork', type: 'fork', position: { x: 100, y: 420 }, size: { width: 160, height: 10 }, properties: { name: 'parallel' } },
      { id: 'a-ship', type: 'action', position: { x: 20, y: 460 }, size: { width: 140, height: 50 }, properties: { name: 'Ship Items' } },
      { id: 'a-notify', type: 'action', position: { x: 200, y: 460 }, size: { width: 140, height: 50 }, properties: { name: 'Send Notification' } },
      { id: 'a-join', type: 'join', position: { x: 100, y: 540 }, size: { width: 160, height: 10 }, properties: { name: 'sync' } },
      { id: 'a-end', type: 'final-node', position: { x: 250, y: 580 }, size: { width: 30, height: 30 }, properties: { name: 'end' } },
    ],
    connectors: [
      { id: 'ac1', type: 'transition', sourceId: 'a-start', targetId: 'a-receive', properties: {} },
      { id: 'ac2', type: 'transition', sourceId: 'a-receive', targetId: 'a-validate', properties: {} },
      { id: 'ac3', type: 'transition', sourceId: 'a-validate', targetId: 'a-decision', properties: {} },
      { id: 'ac4', type: 'transition', sourceId: 'a-decision', targetId: 'a-process', label: '[yes]', properties: {} },
      { id: 'ac5', type: 'transition', sourceId: 'a-decision', targetId: 'a-reject', label: '[no]', properties: {} },
      { id: 'ac6', type: 'transition', sourceId: 'a-process', targetId: 'a-fork', properties: {} },
      { id: 'ac7', type: 'transition', sourceId: 'a-fork', targetId: 'a-ship', properties: {} },
      { id: 'ac8', type: 'transition', sourceId: 'a-fork', targetId: 'a-notify', properties: {} },
      { id: 'ac9', type: 'transition', sourceId: 'a-ship', targetId: 'a-join', properties: {} },
      { id: 'ac10', type: 'transition', sourceId: 'a-notify', targetId: 'a-join', properties: {} },
      { id: 'ac11', type: 'transition', sourceId: 'a-join', targetId: 'a-end', properties: {} },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  // --- 5. State Diagram: Order Lifecycle ---
  const stateDiag: DiagramData = {
    id: 'diag-state',
    name: 'State - Order Lifecycle',
    type: 'state',
    elements: [
      { id: 'st-init', type: 'initial-state', position: { x: 250, y: 10 }, size: { width: 30, height: 30 }, properties: { name: 'init' } },
      { id: 'st-pending', type: 'state', position: { x: 190, y: 70 }, size: { width: 150, height: 60 }, properties: { name: 'Pending' } },
      { id: 'st-confirmed', type: 'state', position: { x: 190, y: 170 }, size: { width: 150, height: 60 }, properties: { name: 'Confirmed' } },
      { id: 'st-processing', type: 'state', position: { x: 190, y: 270 }, size: { width: 150, height: 60 }, properties: { name: 'Processing' } },
      { id: 'st-shipped', type: 'state', position: { x: 190, y: 370 }, size: { width: 150, height: 60 }, properties: { name: 'Shipped' } },
      { id: 'st-delivered', type: 'state', position: { x: 190, y: 470 }, size: { width: 150, height: 60 }, properties: { name: 'Delivered' } },
      { id: 'st-cancelled', type: 'state', position: { x: 420, y: 170 }, size: { width: 150, height: 60 }, properties: { name: 'Cancelled' } },
      { id: 'st-end', type: 'final-state', position: { x: 250, y: 560 }, size: { width: 30, height: 30 }, properties: { name: 'done' } },
    ],
    connectors: [
      { id: 'stc1', type: 'transition', sourceId: 'st-init', targetId: 'st-pending', label: 'create', properties: {} },
      { id: 'stc2', type: 'transition', sourceId: 'st-pending', targetId: 'st-confirmed', label: 'pay', properties: {} },
      { id: 'stc3', type: 'transition', sourceId: 'st-confirmed', targetId: 'st-processing', label: 'process', properties: {} },
      { id: 'stc4', type: 'transition', sourceId: 'st-processing', targetId: 'st-shipped', label: 'ship', properties: {} },
      { id: 'stc5', type: 'transition', sourceId: 'st-shipped', targetId: 'st-delivered', label: 'deliver', properties: {} },
      { id: 'stc6', type: 'transition', sourceId: 'st-delivered', targetId: 'st-end', properties: {} },
      { id: 'stc7', type: 'transition', sourceId: 'st-pending', targetId: 'st-cancelled', label: 'cancel', properties: {} },
      { id: 'stc8', type: 'transition', sourceId: 'st-confirmed', targetId: 'st-cancelled', label: 'cancel', properties: {} },
      { id: 'stc9', type: 'transition', sourceId: 'st-cancelled', targetId: 'st-end', properties: {} },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  const allDiagrams = [classDiag, seqDiag, ucDiag, actDiag, stateDiag];
  const diagramIndex: Record<string, { id: string; name: string; type: DiagramType; parentFolderId: string }> = {};
  const diagrams: Record<string, DiagramData> = {};
  const treeChildren: ProjectTreeNode[] = [];

  for (const d of allDiagrams) {
    diagramIndex[d.id] = { id: d.id, name: d.name, type: d.type, parentFolderId: 'root' };
    diagrams[d.id] = d;
    treeChildren.push({ id: d.id, name: d.name, type: 'diagram', diagramType: d.type });
  }

  return {
    metadata: { name, version: '1.0', createdAt: now, updatedAt: now, diagramIndex },
    tree: [{ id: 'root', name, type: 'folder', children: treeChildren, expanded: true }],
    sharedElements: {},
    diagrams,
  };
}

// =============================================================================
// App Component
// =============================================================================

const App: React.FC = () => {
  const projectStore = useProjectStore();
  const diagramStore = useDiagramStore();

  const [projectFilePath, setProjectFilePath] = useState<string | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [selectedElement, setSelectedElement] = useState<DiagramElement | null>(null);
  const [activeTool, setActiveTool] = useState<ElementType | null>(null);
  const [diagramType, setDiagramType] = useState<DiagramType>('class');
  const [dslText, setDslText] = useState('');
  const [dslErrors, setDslErrors] = useState<DSLError[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // SyncEngine and UndoManager refs
  const undoManagerRef = useRef(new UndoManager());
  const syncEngineRef = useRef<SyncEngine | null>(null);

  // Initialize SyncEngine
  useEffect(() => {
    syncEngineRef.current = new SyncEngine({
      onDiagramUpdate: (diagram) => {
        diagramStore.setDiagram(diagram);
      },
      onTextUpdate: (text) => {
        setDslText(text);
      },
      onErrors: (errors) => {
        setDslErrors(errors);
      },
      undoManager: undoManagerRef.current,
      debounceMs: 300,
    });
  }, []);

  // Auto-load example project on mount
  useEffect(() => {
    const project = createEmptyProject('New Project');
    setProjectData(project);
    projectStore.setMetadata(project.metadata);
    projectStore.setTree(project.tree);
    projectStore.setDirty(false);

    const firstDiagramId = Object.keys(project.diagrams)[0];
    if (firstDiagramId) {
      projectStore.openDiagram(firstDiagramId);
      const diagram = project.diagrams[firstDiagramId];
      diagramStore.setDiagram(diagram);
      syncEngineRef.current?.setDiagram(diagram);
      setDslText(serializeDSL(diagram));
    }
  }, []);

  // Resize canvas to fit container
  useEffect(() => {
    const updateSize = () => {
      if (canvasContainerRef.current) {
        setCanvasSize({
          width: canvasContainerRef.current.clientWidth,
          height: canvasContainerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // ==========================================================================
  // Unsaved changes confirmation
  // ==========================================================================

  const confirmUnsavedChanges = useCallback((): boolean => {
    if (!projectStore.dirty) return true;
    return window.confirm(
      'You have unsaved changes. Do you want to continue without saving?',
    );
  }, [projectStore.dirty]);

  // ==========================================================================
  // New Project
  // ==========================================================================

  const handleNewProject = useCallback(() => {
    if (!confirmUnsavedChanges()) return;

    const project = createEmptyProject('New Project');
    setProjectData(project);
    setProjectFilePath(null);
    projectStore.setMetadata(project.metadata);
    projectStore.setTree(project.tree);
    projectStore.setDirty(false);

    const firstDiagramId = Object.keys(project.diagrams)[0];
    if (firstDiagramId) {
      projectStore.openDiagram(firstDiagramId);
      const diagram = project.diagrams[firstDiagramId];
      diagramStore.setDiagram(diagram);
      syncEngineRef.current?.setDiagram(diagram);
      setDslText(serializeDSL(diagram));
    }
  }, [confirmUnsavedChanges, projectStore, diagramStore]);

  // ==========================================================================
  // Save Project
  // ==========================================================================

  const handleSaveProject = useCallback(async () => {
    if (!projectData) return;

    const currentDiagram = diagramStore.diagram;
    const updatedData = { ...projectData };
    if (currentDiagram && projectStore.activeDiagramId) {
      updatedData.diagrams = {
        ...updatedData.diagrams,
        [projectStore.activeDiagramId]: currentDiagram,
      };
    }
    updatedData.metadata = {
      ...updatedData.metadata,
      updatedAt: new Date().toISOString(),
    };

    const serialized = ProjectFileSerializer.serialize(updatedData);

    let savePath = projectFilePath;
    if (!savePath && window.electronAPI) {
      savePath = await window.electronAPI.showSaveDialog({
        title: 'Save Project',
        defaultPath: `${updatedData.metadata.name}.uml.json`,
        filters: [{ name: 'UML Project', extensions: ['uml.json'] }],
      });
      if (!savePath) return;
    }

    if (savePath && window.electronAPI) {
      try {
        await window.electronAPI.saveProject(savePath, serialized);
        setProjectFilePath(savePath);
        setProjectData(updatedData);
        projectStore.setDirty(false);
        await window.electronAPI.addRecentProject(savePath);
      } catch (err) {
        alert(`Failed to save project: ${(err as Error).message}`);
      }
    }
  }, [projectData, projectFilePath, diagramStore.diagram, projectStore]);

  // ==========================================================================
  // Open Project
  // ==========================================================================

  const handleOpenProject = useCallback(async () => {
    if (!confirmUnsavedChanges()) return;
    if (!window.electronAPI) return;

    const filePath = await window.electronAPI.showOpenDialog({
      title: 'Open Project',
      filters: [{ name: 'UML Project', extensions: ['uml.json'] }],
      properties: ['openFile'],
    });
    if (!filePath) return;

    try {
      const content = await window.electronAPI.loadProject(filePath);
      const result = ProjectFileParser.parseAll(content);
      if (!result.success) {
        alert(`Failed to parse project: ${result.errors.map((e) => e.message).join('\n')}`);
        return;
      }

      const project = result.data;
      setProjectData(project);
      setProjectFilePath(filePath);
      projectStore.setMetadata(project.metadata);
      projectStore.setTree(project.tree);
      projectStore.setDirty(false);
      projectStore.reset();
      projectStore.setMetadata(project.metadata);
      projectStore.setTree(project.tree);

      const firstId = Object.keys(project.diagrams)[0];
      if (firstId) {
        projectStore.openDiagram(firstId);
        const diagram = project.diagrams[firstId];
        diagramStore.setDiagram(diagram);
        syncEngineRef.current?.setDiagram(diagram);
        setDslText(serializeDSL(diagram));
      }

      await window.electronAPI.addRecentProject(filePath);
    } catch (err) {
      alert(`Failed to open project: ${(err as Error).message}`);
    }
  }, [confirmUnsavedChanges, projectStore, diagramStore]);

  // ==========================================================================
  // SyncEngine handlers
  // ==========================================================================

  const handleDslChange = useCallback((text: string) => {
    setDslText(text);
    syncEngineRef.current?.onTextChange(text);
    projectStore.setDirty(true);
  }, [projectStore]);

  const handleCanvasChange = useCallback((change: CanvasChange) => {
    syncEngineRef.current?.onCanvasChange(change);
    projectStore.setDirty(true);
  }, [projectStore]);

  const handleElementDoubleClick = useCallback((elementId: string) => {
    const el = diagramStore.diagram?.elements.find((e) => e.id === elementId);
    if (el) setSelectedElement(el);
  }, [diagramStore.diagram]);

  const handleSelectionChange = useCallback((selectedIds: string[]) => {
    if (selectedIds.length === 1) {
      const el = diagramStore.diagram?.elements.find((e) => e.id === selectedIds[0]);
      if (el) setSelectedElement(el);
    } else {
      setSelectedElement(null);
    }
  }, [diagramStore.diagram]);

  // ==========================================================================
  // Diagram tab management
  // ==========================================================================

  const handleDiagramOpen = useCallback(
    (diagramId: string) => {
      projectStore.openDiagram(diagramId);
      if (projectData?.diagrams[diagramId]) {
        const diagram = projectData.diagrams[diagramId];
        diagramStore.setDiagram(diagram);
        syncEngineRef.current?.setDiagram(diagram);
        setDslText(serializeDSL(diagram));
        setDiagramType(diagram.type);
      }
    },
    [projectStore, diagramStore, projectData],
  );

  const handleTabClick = useCallback(
    (diagramId: string) => {
      projectStore.setActiveDiagram(diagramId);
      if (projectData?.diagrams[diagramId]) {
        const diagram = projectData.diagrams[diagramId];
        diagramStore.setDiagram(diagram);
        syncEngineRef.current?.setDiagram(diagram);
        setDslText(serializeDSL(diagram));
        setDiagramType(diagram.type);
      }
    },
    [projectStore, diagramStore, projectData],
  );

  const handleTabClose = useCallback(
    (diagramId: string) => {
      projectStore.closeDiagram(diagramId);
    },
    [projectStore],
  );

  const handleTreeChange = useCallback(
    (tree: ProjectTreeNode[]) => {
      projectStore.setTree(tree);
      projectStore.setDirty(true);
    },
    [projectStore],
  );

  const handlePropertyChange = useCallback(
    (elementId: string, properties: Partial<ElementProperties>) => {
      diagramStore.updateElementProperties(elementId, properties);
      projectStore.setDirty(true);
      const updated = diagramStore.diagram?.elements.find((e) => e.id === elementId);
      if (updated) setSelectedElement({ ...updated, properties: { ...updated.properties, ...properties } });
      // Sync text editor
      const diagram = diagramStore.getDiagram();
      if (diagram) {
        syncEngineRef.current?.setDiagram(diagram);
        setDslText(serializeDSL(diagram));
      }
    },
    [diagramStore, projectStore],
  );

  // ==========================================================================
  // Build tab info
  // ==========================================================================

  const tabs: DiagramTabInfo[] = projectStore.openDiagramIds.map((id) => ({
    id,
    name: projectData?.diagrams[id]?.name ?? projectStore.metadata?.diagramIndex[id]?.name ?? id,
    dirty: projectStore.dirty,
  }));

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Menu bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          borderBottom: '1px solid #ddd',
          background: '#f0f0f0',
          flexShrink: 0,
        }}
      >
        <button onClick={handleNewProject} style={menuBtnStyle}>New</button>
        <button onClick={handleOpenProject} style={menuBtnStyle}>Open</button>
        <button onClick={handleSaveProject} style={menuBtnStyle}>Save</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#666' }}>
          {projectStore.metadata?.name ?? 'No Project'}
          {projectStore.dirty ? ' •' : ''}
        </span>
      </div>

      {/* Toolbar */}
      <Toolbar
        diagramType={diagramType}
        onDiagramTypeChange={setDiagramType}
        onToolSelect={setActiveTool}
        activeTool={activeTool}
      />

      {/* Diagram tabs */}
      <DiagramTabs
        tabs={tabs}
        activeTabId={projectStore.activeDiagramId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
      />

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar: Project Tree */}
        <div
          style={{
            width: 220,
            borderRight: '1px solid #ddd',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <ProjectTree
            tree={projectStore.tree}
            activeDiagramId={projectStore.activeDiagramId}
            onDiagramOpen={handleDiagramOpen}
            onTreeChange={handleTreeChange}
          />
        </div>

        {/* Center: Split View (Editor + Canvas) */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SplitView
            editorPanel={
              <DSLEditor
                value={dslText}
                onChange={handleDslChange}
                errors={dslErrors}
              />
            }
            canvasPanel={
              <div ref={canvasContainerRef} style={{ width: '100%', height: '100%' }}>
                <UMLCanvas
                  width={canvasSize.width}
                  height={canvasSize.height}
                  onCanvasChange={handleCanvasChange}
                  onElementDoubleClick={handleElementDoubleClick}
                  onSelectionChange={handleSelectionChange}
                />
              </div>
            }
          />
        </div>

        {/* Right sidebar: Property Panel */}
        <div
          style={{
            width: 240,
            borderLeft: '1px solid #ddd',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <PropertyPanel
            element={selectedElement}
            onPropertyChange={handlePropertyChange}
          />
        </div>
      </div>
    </div>
  );
};

const menuBtnStyle: React.CSSProperties = {
  padding: '4px 12px',
  fontSize: 12,
  border: '1px solid #ccc',
  borderRadius: 3,
  background: '#fff',
  cursor: 'pointer',
};

export default App;
