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
import { ProjectSession } from './engine/projectSession';
import { downloadProject, downloadArtifact } from './engine/browserProjectFile';
import { createProject } from './engine/projectFactory';
import { CreateDialog } from './components/project/CreateDialog';
import { HistoryDialog } from './components/project/HistoryDialog';
import { ExportEngine } from './engine/exportEngine';
import { ProjectFileSerializer } from './parser/project/projectFileSerializer';
import { ProjectFileParser } from './parser/project/projectFileParser';
import type {
  ProjectData,
  ProjectTreeNode,
  DiagramType,
  CanvasTool,
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
  saveExport(name: string, format: 'svg' | 'png', data: string): Promise<boolean>;
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

function createExampleProject(name: string): ProjectData {
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
  const [activeTool, setActiveTool] = useState<CanvasTool | null>(null);
  const [diagramType, setDiagramType] = useState<DiagramType>('class');
  const [dslText, setDslText] = useState('');
  const [dslErrors, setDslErrors] = useState<DSLError[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [fileBusy, setFileBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'project' | 'diagram' | null>(null);
  const [projectGeneration, setProjectGeneration] = useState(0);
  const [fileNotice, setFileNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const workspaceRef = useRef<ProjectSession | null>(null);
  const fileBusyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasObserverRef = useRef<ResizeObserver | null>(null);

  const refreshWorkspace = useCallback(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const store = useProjectStore.getState();
    setProjectData(workspace.project);
    store.setMetadata(workspace.project.metadata);
    store.setTree(workspace.project.tree);
    store.setDirty(workspace.dirty);
    for (const id of store.openDiagramIds) {
      if (!Object.prototype.hasOwnProperty.call(workspace.project.diagrams, id)) store.closeDiagram(id);
    }
    const id = useProjectStore.getState().activeDiagramId;
    const session = id ? workspace.getSession(id) : undefined;
    const diagram = session?.sync.getDiagram();
    if (id && diagram && session) {
      useDiagramStore.getState().setDiagram(diagram);
      setDslText(workspace.text(id));
      setDslErrors(session.sync.getErrors());
      setDiagramType(diagram.type);
      setSelectedElement((selected) => selected
        ? diagram.elements.find((element) => element.id === selected.id) ?? null : null);
    } else {
      useDiagramStore.getState().reset();
      setDslText('');
      setDslErrors([]);
      setSelectedElement(null);
    }
  }, []);

  const replaceProject = useCallback((project: ProjectData, filePath: string | null) => {
    workspaceRef.current?.dispose();
    workspaceRef.current = new ProjectSession(project, refreshWorkspace);
    setProjectGeneration((generation) => generation + 1);
    const store = useProjectStore.getState();
    store.reset();
    const firstId = Object.keys(project.diagrams)[0];
    if (firstId) store.openDiagram(firstId);
    setProjectFilePath(filePath);
    setSelectedElement(null);
    setActiveTool(null);
    refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    replaceProject(createProject('Untitled Project'), null);
    return () => workspaceRef.current?.dispose();
  }, [replaceProject]);

  // Observe the actual panel, including splitter drags and view-mode changes.
  const canvasContainerRef = useCallback((node: HTMLDivElement | null) => {
    canvasObserverRef.current?.disconnect();
    if (!node) return;
    const updateSize = () => setCanvasSize({ width: node.clientWidth, height: node.clientHeight });
    updateSize();
    canvasObserverRef.current = new ResizeObserver(updateSize);
    canvasObserverRef.current.observe(node);
  }, []);

  const confirmUnsavedChanges = useCallback(() => !workspaceRef.current?.dirty || window.confirm(
    'You have unsaved changes. Continue without saving?',
  ), []);

  useEffect(() => {
    if (!projectStore.dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [projectStore.dirty]);

  const handleNewProject = useCallback(() => {
    if (!fileBusyRef.current) setCreateMode('project');
  }, []);

  const handleCreate = useCallback((name: string, type: DiagramType, folder: string) => {
    if (fileBusyRef.current) return;
    if (createMode === 'project') {
      if (!confirmUnsavedChanges()) return;
      replaceProject(createProject(name), null);
    } else {
      const id = workspaceRef.current?.addDiagram(name, type, folder);
      if (id) {
        useProjectStore.getState().openDiagram(id);
        setSelectedElement(null);
        setActiveTool(null);
        refreshWorkspace();
      }
    }
    setCreateMode(null);
    setFileNotice(null);
  }, [createMode, confirmUnsavedChanges, replaceProject, refreshWorkspace]);

  const handleExamples = useCallback(() => {
    if (fileBusyRef.current || !confirmUnsavedChanges()) return;
    replaceProject(createExampleProject('Example Project'), null);
    setFileNotice(null);
  }, [confirmUnsavedChanges, replaceProject]);

  const handleExport = useCallback(async (format: 'svg' | 'png') => {
    const id = useProjectStore.getState().activeDiagramId;
    const session = id ? workspaceRef.current?.getSession(id) : undefined;
    if (!session || fileBusyRef.current) return;
    if (!session.sync.flushPendingText()) {
      setFileNotice({ text: 'Fix the DSL errors before exporting. Save still keeps your draft.', error: true });
      return;
    }
    const diagram = session.sync.getDiagram();
    if (!diagram) return;
    fileBusyRef.current = true;
    setFileBusy(true);
    try {
      const data = format === 'svg' ? ExportEngine.exportSVG(diagram) : await ExportEngine.exportPNG(diagram);
      if (window.electronAPI) {
        const saved = await window.electronAPI.saveExport(diagram.name, format, data);
        if (!saved) return;
      } else downloadArtifact(data, `${diagram.name}.${format}`, format === 'svg' ? 'image/svg+xml' : 'image/png');
      setFileNotice({ text: `${format.toUpperCase()} export ${window.electronAPI ? 'saved' : 'download started'}.` });
    } catch (error) {
      setFileNotice({ text: `Could not export: ${(error as Error).message}`, error: true });
    } finally { fileBusyRef.current = false; setFileBusy(false); }
  }, []);

  const rememberProject = async (filePath: string) => {
    try {
      await window.electronAPI?.addRecentProject(filePath);
    } catch {
      // A recent-file list failure must not turn a successful save/open into a failure.
    }
  };

  const handleSaveProject = useCallback(async () => {
    const workspace = workspaceRef.current;
    if (!workspace || fileBusyRef.current) return;
    fileBusyRef.current = true;
    setFileBusy(true);
    setFileNotice({ text: 'Saving project…' });
    try {
      let savePath = projectFilePath;
      const api = window.electronAPI;
      if (api && !savePath) {
        savePath = await api.showSaveDialog({
          title: 'Save Project',
          defaultPath: `${workspace.project.metadata.name}.uml.json`,
          filters: [{ name: 'UML Project', extensions: ['uml.json'] }],
        });
        if (!savePath) {
          setFileNotice(null);
          return;
        }
      }
      const snapshot = workspace.snapshot();
      const serialized = ProjectFileSerializer.serialize(snapshot.project);
      if (api && savePath) {
        await api.saveProject(savePath, serialized);
        setProjectFilePath(savePath);
      } else {
        downloadProject(serialized, snapshot.project.metadata.name);
        // A browser request has no persistence acknowledgement. Keep the saved
        // revision unchanged so blocked/cancelled downloads retain dirty guards.
        setFileNotice({ text: workspace.dirty
          ? 'Download requested (.uml.json). Verify the file; changes remain unsaved.'
          : 'Download requested (.uml.json). Verify the file before closing.' });
        return;
      }
      workspace.markSaved(snapshot.revision, snapshot.project.metadata.updatedAt);
      setFileNotice({ text: workspace.dirty
        ? 'Saved. Newer edits are still unsaved.'
        : 'Project saved.' });
      if (api && savePath) await rememberProject(savePath);
    } catch (error) {
      setFileNotice({ text: `Could not save project: ${(error as Error).message}`, error: true });
    } finally {
      fileBusyRef.current = false;
      setFileBusy(false);
    }
  }, [projectFilePath]);

  const loadProjectContent = useCallback((content: string, path: string | null): boolean => {
    const result = ProjectFileParser.parseAll(content);
    if (!result.success) {
      setFileNotice({ text: `Could not open project: ${result.errors.map((error) => error.message).join('; ')}`, error: true });
      return false;
    }
    // Check after reading so edits made while the picker/read was pending are protected.
    if (!confirmUnsavedChanges()) return false;
    replaceProject(result.data, path);
    setFileNotice({ text: 'Project opened.' });
    return true;
  }, [confirmUnsavedChanges, replaceProject]);

  const handleOpenProject = useCallback(async () => {
    if (fileBusyRef.current) return;
    const api = window.electronAPI;
    if (!api) {
      fileInputRef.current?.click();
      return;
    }
    fileBusyRef.current = true;
    setFileBusy(true);
    try {
      const path = await api.showOpenDialog({
        title: 'Open Project',
        filters: [{ name: 'UML Project', extensions: ['uml.json'] }],
        properties: ['openFile'],
      });
      if (path && loadProjectContent(await api.loadProject(path), path)) await rememberProject(path);
    } catch (error) {
      setFileNotice({ text: `Could not open project: ${(error as Error).message}`, error: true });
    } finally {
      fileBusyRef.current = false;
      setFileBusy(false);
    }
  }, [loadProjectContent]);

  const handleBrowserFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || fileBusyRef.current) return;
    fileBusyRef.current = true;
    setFileBusy(true);
    try {
      loadProjectContent(await file.text(), null);
    } catch (error) {
      setFileNotice({ text: `Could not open project: ${(error as Error).message}`, error: true });
    } finally {
      fileBusyRef.current = false;
      setFileBusy(false);
    }
  }, [loadProjectContent]);

  const handleDslChange = useCallback((text: string) => {
    const id = useProjectStore.getState().activeDiagramId;
    if (id) workspaceRef.current?.editText(id, text);
  }, []);

  const handleCanvasChange = useCallback((change: CanvasChange) => {
    const id = useProjectStore.getState().activeDiagramId;
    if (id && !workspaceRef.current?.editCanvas(id, change)) {
      setFileNotice({ text: 'Fix the DSL errors before editing the canvas. Your draft can still be saved.', error: true });
      refreshWorkspace();
    }
  }, [refreshWorkspace]);

  const handleUndo = useCallback(() => {
    const id = useProjectStore.getState().activeDiagramId;
    if (id) workspaceRef.current?.undo(id);
  }, []);

  const handleRedo = useCallback(() => {
    const id = useProjectStore.getState().activeDiagramId;
    if (id) workspaceRef.current?.redo(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 's' || key === 'o') {
        event.preventDefault();
        if (key === 's') void handleSaveProject();
        else void handleOpenProject();
        return;
      }
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (key === 'z' || key === 'y') {
        event.preventDefault();
        if (key === 'y' || event.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [handleSaveProject, handleOpenProject, handleUndo, handleRedo]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedElement(ids.length === 1
      ? useDiagramStore.getState().diagram?.elements.find((element) => element.id === ids[0]) ?? null
      : null);
  }, []);

  const handleDiagramOpen = useCallback((id: string) => {
    const workspace = workspaceRef.current;
    const store = useProjectStore.getState();
    if (!workspace?.getSession(id) || store.activeDiagramId === id) return;
    if (store.activeDiagramId) workspace.getSession(store.activeDiagramId)?.sync.flushPendingText();
    store.openDiagram(id);
    setSelectedElement(null);
    setActiveTool(null);
    refreshWorkspace();
  }, [refreshWorkspace]);

  const handleTabClose = useCallback((id: string) => {
    const store = useProjectStore.getState();
    workspaceRef.current?.getSession(id)?.sync.flushPendingText();
    const wasActive = store.activeDiagramId === id;
    store.closeDiagram(id);
    if (wasActive) {
      setSelectedElement(null);
      setActiveTool(null);
      refreshWorkspace();
    }
  }, [refreshWorkspace]);

  const handleTreeChange = useCallback((tree: ProjectTreeNode[]) => {
    workspaceRef.current?.setTree(tree);
  }, []);

  const handlePropertyChange = useCallback((elementId: string, properties: Partial<ElementProperties>) => {
    handleCanvasChange({ type: 'element-update', elementId, properties });
  }, [handleCanvasChange]);

  const tabs: DiagramTabInfo[] = projectStore.openDiagramIds.map((id) => ({
    id,
    name: projectData?.diagrams[id]?.name ?? id,
    dirty: projectStore.dirty,
  }));
  const activeDiagram = diagramStore.diagram;
  const activeSession = projectStore.activeDiagramId
    ? workspaceRef.current?.getSession(projectStore.activeDiagramId) : undefined;
  const diagramElements = Object.fromEntries(Object.entries(projectData?.diagrams ?? {}).map(([id, diagram]) => [
    id, diagram.elements.map((element) => element.properties.name),
  ]));
  const activeToolLabel = activeTool ? activeTool.type.replace(/-/g, ' ') : 'Select';

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div className="app-shell">
      {createMode && <CreateDialog mode={createMode} tree={projectStore.tree} onCancel={() => setCreateMode(null)} onCreate={handleCreate} />}
      {historyOpen && projectData && <HistoryDialog project={projectData}
        getSnapshot={() => workspaceRef.current!.snapshot().project}
        onClose={() => setHistoryOpen(false)}
        onRestore={(project) => {
          replaceProject(project, projectFilePath);
          workspaceRef.current?.markUnsaved();
          setHistoryOpen(false);
          setFileNotice({ text: 'Snapshot restored. Save to update your project file.' });
        }} />}
      {/* Menu bar */}
      <div className="app-menubar">
        <div className="app-brand" title="UML Studio">
          <div className="app-brand-mark">U</div>
          <span>UML Studio</span>
        </div>
        <button onClick={handleNewProject} disabled={fileBusy} className="menu-button">New</button>
        <button onClick={() => setCreateMode('diagram')} disabled={fileBusy} className="menu-button">+ Diagram</button>
        <button onClick={handleExamples} disabled={fileBusy} className="menu-button">Examples</button>
        <button onClick={handleOpenProject} disabled={fileBusy} title="Open project (Cmd/Ctrl+O)" className="menu-button">Open</button>
        <button onClick={handleSaveProject} disabled={fileBusy} title="Save project (Cmd/Ctrl+S)" className="menu-button">{fileBusy ? 'Working…' : 'Save'}</button>
        <button
          onClick={handleUndo}
          disabled={!activeSession?.history.canUndo() || dslErrors.length > 0}
          className="menu-button"
          title="Undo (Cmd/Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={!activeSession?.history.canRedo() || dslErrors.length > 0}
          className="menu-button"
          title="Redo (Cmd/Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button className="menu-button" disabled={fileBusy} onClick={() => setHistoryOpen(true)}>History</button>
        <button className="menu-button properties-toggle" aria-expanded={propertiesOpen} onClick={() => setPropertiesOpen((open) => !open)}>Properties</button>
        <button onClick={() => handleExport('svg')} disabled={fileBusy || !activeDiagram?.elements.length || dslErrors.length > 0} className="menu-button">Export SVG</button>
        <button onClick={() => handleExport('png')} disabled={fileBusy || !activeDiagram?.elements.length || dslErrors.length > 0} className="menu-button">Export PNG</button>
        <div className="app-spacer" />
        <div className="project-chip" title={projectFilePath ?? undefined}>
          <span>{projectStore.metadata?.name ?? 'No Project'}</span>
          {projectStore.dirty && <span className="dirty-dot" title="Unsaved changes" />}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".uml.json,.json,application/json" hidden onChange={handleBrowserFile} aria-label="Open UML project file" />
      {fileNotice && (
        <div className={`file-notice${fileNotice.error ? ' is-error' : ''}`} role={fileNotice.error ? 'alert' : 'status'}>
          <span>{fileNotice.text}</span>
          <button onClick={() => setFileNotice(null)} className="tree-action-button" aria-label="Dismiss notification">×</button>
        </div>
      )}

      {/* Toolbar */}
      <Toolbar
        diagramType={diagramType}
        disabled={!activeDiagram || dslErrors.length > 0}
        onToolSelect={(tool) => {
          setActiveTool((current) =>
            current?.kind === tool.kind && current.type === tool.type ? null : tool,
          );
        }}
        activeTool={activeTool}
      />

      {/* Diagram tabs */}
      <DiagramTabs
        tabs={tabs}
        activeTabId={projectStore.activeDiagramId}
        onTabClick={handleDiagramOpen}
        onTabClose={handleTabClose}
      />

      {/* Main content area */}
      <div className="app-main">
        {/* Left sidebar: Project Tree */}
        <div className="sidebar sidebar-left">
          <ProjectTree
            key={projectGeneration}
            tree={projectStore.tree}
            activeDiagramId={projectStore.activeDiagramId}
            onDiagramOpen={handleDiagramOpen}
            onTreeChange={handleTreeChange}
            onSearchResultClick={(diagramId) => handleDiagramOpen(diagramId)}
            diagramElements={diagramElements}
          />
        </div>

        {/* Center: Split View (Editor + Canvas) */}
        <div className="workspace">
          {!activeDiagram ? <div className="workspace-empty">
            <div className="app-brand-mark">U</div>
            <h1>Start your next diagram</h1>
            <p>Create a class, sequence, use case, activity, or state diagram.</p>
            <button className="menu-button" onClick={() => setCreateMode('diagram')}>Create diagram</button>
            <p>Open a saved project or choose Examples to explore.</p>
          </div> : <SplitView
            editorPanel={
              <DSLEditor
                key={`${projectGeneration}:${projectStore.activeDiagramId ?? 'empty'}`}
                readOnly={!activeDiagram}
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
                  readOnly={dslErrors.length > 0 || !activeDiagram}
                  activeTool={activeTool}
                  onCanvasChange={handleCanvasChange}
                  onElementDoubleClick={(id) => { handleSelectionChange([id]); setPropertiesOpen(true); }}
                  onSelectionChange={handleSelectionChange}
                />
              </div>
            }
          />}
        </div>

        {/* Right sidebar: Property Panel */}
        <div className={`sidebar sidebar-right${propertiesOpen ? ' is-open' : ''}`}>
          <PropertyPanel
            element={selectedElement}
            onPropertyChange={handlePropertyChange}
          />
        </div>
      </div>
      <div className="status-bar">
        <span className="status-pill">{activeDiagram?.name ?? 'No diagram'}</span>
        <span className="status-pill">{activeDiagram?.elements.length ?? 0} elements</span>
        <span className="status-pill">{activeDiagram?.connectors.length ?? 0} connectors</span>
        <span className="status-pill">Tool: {activeToolLabel}</span>
        <span className="app-spacer" />
        <span className="status-pill">{projectStore.dirty ? 'Unsaved changes' : 'No unsaved changes'}</span>
        {dslErrors.length > 0 && (
          <span className="status-pill status-error">{dslErrors.length} DSL errors</span>
        )}
      </div>
    </div>
  );
};

export default App;
