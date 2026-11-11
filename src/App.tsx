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
import { createExampleProject, createProject } from './engine/projectFactory';
import { CreateDialog } from './components/project/CreateDialog';
import { HistoryDialog } from './components/project/HistoryDialog';
import { ConflictDialog } from './components/project/ConflictDialog';
import { findTextModelConflicts, resolveTextModelConflicts, type ConflictChoice, type TextModelConflict } from './engine/textModelConflicts';
import { ExportEngine } from './engine/exportEngine';
import { checkProjectData, readProjectFile, writeProjectFile } from './parser/project/projectFileIO';
import { version as appVersion } from '../package.json';
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

  /**
   * Swap in another project only after it passes every Open rule (A03.08). On
   * failure the current project, tree and tabs stay exactly as they were.
   */
  const replaceProject = useCallback((candidate: ProjectData, filePath: string | null, projectId?: string): string | null => {
    const checked = checkProjectData(candidate);
    if (!checked.success) {
      const shown = checked.errors.slice(0, 3).map((error) => error.message).join('; ');
      const more = checked.errors.length > 3 ? ` (and ${checked.errors.length - 3} more)` : '';
      return `${shown}${more}`;
    }
    const project = checked.data.project;
    workspaceRef.current?.dispose();
    workspaceRef.current = new ProjectSession(project, refreshWorkspace, { projectId });
    setProjectGeneration((generation) => generation + 1);
    const store = useProjectStore.getState();
    store.reset();
    const firstId = Object.keys(project.diagrams)[0];
    if (firstId) store.openDiagram(firstId);
    setProjectFilePath(filePath);
    setSelectedElement(null);
    setActiveTool(null);
    refreshWorkspace();
    return null;
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
      const problem = replaceProject(createProject(name), null);
      if (problem) {
        setFileNotice({ text: `Could not create the project: ${problem}`, error: true });
        return;
      }
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
    const problem = replaceProject(createExampleProject('Example Project'), null);
    setFileNotice(problem ? { text: `Could not load the examples: ${problem}`, error: true } : null);
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
      const snapshot = workspace.documentSnapshot();
      const serialized = writeProjectFile(snapshot.document, { app: 'UML Studio', version: appVersion });
      if (api && savePath) {
        await api.saveProject(savePath, serialized);
        setProjectFilePath(savePath);
      } else {
        downloadProject(serialized, snapshot.document.project.name);
        // A browser request has no persistence acknowledgement. Keep the saved
        // revision unchanged so blocked/cancelled downloads retain dirty guards.
        setFileNotice({ text: workspace.dirty
          ? 'Download requested (.uml.json). Verify the file; changes remain unsaved.'
          : 'Download requested (.uml.json). Verify the file before closing.' });
        return;
      }
      workspace.markSaved(snapshot.revision, snapshot.document.project.updatedAt);
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

  // A03.09: the open waits here while the user chooses between stored text and diagram.
  const [conflictReview, setConflictReview] = useState<{
    conflicts: TextModelConflict[];
    decide: (choices: Record<string, ConflictChoice> | null) => void;
  } | null>(null);
  const askConflictChoices = useCallback((conflicts: TextModelConflict[]) => (
    new Promise<Record<string, ConflictChoice> | null>((resolve) => {
      setConflictReview({ conflicts, decide: (choices) => { setConflictReview(null); resolve(choices); } });
    })
  ), []);

  const loadProjectContent = useCallback(async (content: string, path: string | null): Promise<boolean> => {
    const result = readProjectFile(content, { createId: () => crypto.randomUUID() });
    if (!result.success) {
      setFileNotice({ text: `Could not open project: ${result.errors.map((error) => error.message).join('; ')}`, error: true });
      return false;
    }
    // Check after reading so edits made while the picker/read was pending are protected.
    if (!confirmUnsavedChanges()) return false;
    const { projectId, migrated, invalidDrafts } = result.data;
    let { project } = result.data;
    const conflicts = findTextModelConflicts(project);
    if (conflicts.length > 0) {
      const choices = await askConflictChoices(conflicts);
      if (!choices) {
        setFileNotice({ text: 'Open cancelled. Your current project is unchanged.' });
        return false;
      }
      project = resolveTextModelConflicts(project, conflicts, choices);
    }
    const problem = replaceProject(project, path, projectId);
    if (problem) {
      setFileNotice({ text: `Could not open project: ${problem}`, error: true });
      return false;
    }
    // A migrated file is not on disk in the new format yet (ADR 0001 §3), and a
    // resolved conflict is a choice the file does not hold yet.
    if (migrated || conflicts.length > 0) workspaceRef.current?.markUnsaved();
    const drafts = invalidDrafts.length > 0
      ? ` ${invalidDrafts.length} diagram${invalidDrafts.length > 1 ? 's have' : ' has'} DSL errors; the canvas shows the last valid diagram.`
      : '';
    const resolved = conflicts.length > 0 && !migrated ? ' Save to keep your text/diagram choice in the file.' : '';
    setFileNotice({ text: (migrated
      ? 'Opened a project saved by an older version. Save to upgrade the file.'
      : 'Project opened.') + resolved + drafts });
    return true;
  }, [askConflictChoices, confirmUnsavedChanges, replaceProject]);

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
      if (path && await loadProjectContent(await api.loadProject(path), path)) await rememberProject(path);
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
      await loadProjectContent(await file.text(), null);
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
    const result = id ? workspaceRef.current?.tryEditCanvas(id, change) : undefined;
    if (result && !result.ok) {
      const text = result.reason === 'draft'
        ? 'Fix the DSL errors before editing the canvas. Your draft can still be saved.'
        : result.reason === 'rules'
          ? `Not applied: ${result.errors[0].message}.`
          : 'This change cannot be written as valid DSL, so it was not applied.';
      if (result.reason !== 'busy') setFileNotice({ text, error: true });
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
    return null;
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
      {conflictReview && <ConflictDialog conflicts={conflictReview.conflicts}
        onCancel={() => conflictReview.decide(null)} onOpen={(choices) => conflictReview.decide(choices)} />}
      {historyOpen && projectData && <HistoryDialog project={projectData}
        getSnapshot={() => workspaceRef.current!.snapshot().project}
        onClose={() => setHistoryOpen(false)}
        onRestore={(project) => {
          const problem = replaceProject(project, projectFilePath, workspaceRef.current?.projectId);
          // The dialog stays open and shows why; the current project is untouched.
          if (problem) throw new Error(`This snapshot cannot be restored: ${problem}`);
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
          disabled={!activeSession?.history.canUndo()}
          className="menu-button"
          title="Undo (Cmd/Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={!activeSession?.history.canRedo()}
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
              <div ref={canvasContainerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
                {dslErrors.length > 0 && (
                  <div className="canvas-stale" role="status">
                    Showing the last valid version. Fix the DSL errors to edit the canvas; your text draft is kept.
                  </div>
                )}
                <UMLCanvas
                  key={projectGeneration}
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
            disabled={dslErrors.length > 0}
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
