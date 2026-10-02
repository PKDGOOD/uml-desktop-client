// =============================================================================
// Core Data Model Types - UML Desktop Client
// =============================================================================

// --- Diagram Type ---

export type DiagramType = 'class' | 'sequence' | 'usecase' | 'activity' | 'state';

// --- Geometry ---

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number; // 0.25 ~ 4.0
}

// --- Element Properties ---

export interface Attribute {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected' | 'package';
  isStatic?: boolean;
}

export interface Parameter {
  name: string;
  type: string;
}

export interface Method {
  name: string;
  returnType: string;
  parameters: Parameter[];
  visibility: 'public' | 'private' | 'protected' | 'package';
  isStatic?: boolean;
  isAbstract?: boolean;
}

export interface ElementProperties {
  name: string;
  stereotype?: string;
  visibility?: 'public' | 'private' | 'protected' | 'package';
  attributes?: Attribute[];
  methods?: Method[];
  description?: string;
  [key: string]: unknown;
}

// --- Element Types ---

export type ElementType =
  // Class diagram
  | 'class' | 'interface' | 'abstract-class' | 'enum'
  // Sequence diagram
  | 'lifeline' | 'activation' | 'message'
  // Use case diagram
  | 'actor' | 'usecase' | 'system-boundary'
  // Activity diagram
  | 'action' | 'decision' | 'fork' | 'join' | 'initial-node' | 'final-node'
  // State diagram
  | 'state' | 'initial-state' | 'final-state' | 'composite-state'
  // Shared
  | 'note' | 'package';

// --- Diagram Element ---

export interface DiagramElement {
  id: string;
  type: ElementType;
  position: Position;
  size: Size;
  properties: ElementProperties;
  /** Reference ID when this element is shared */
  sharedRefId?: string;
}

// --- Connector Types ---

export type ConnectorType =
  | 'association' | 'directed-association'
  | 'aggregation' | 'composition'
  | 'inheritance' | 'realization'
  | 'dependency' | 'usage'
  // Sequence diagram
  | 'sync-message' | 'async-message' | 'return-message'
  // Use case diagram
  | 'include' | 'extend'
  // Activity/state diagram
  | 'transition';

export type CanvasTool =
  | { kind: 'element'; type: ElementType }
  | { kind: 'connector'; type: ConnectorType };

export interface ConnectorProperties {
  lineStyle?: 'solid' | 'dashed';
  arrowStyle?: 'open' | 'closed' | 'diamond' | 'diamond-filled';
  [key: string]: unknown;
}

export interface Connector {
  id: string;
  type: ConnectorType;
  sourceId: string;
  targetId: string;
  waypoints?: Position[];
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  properties: ConnectorProperties;
}

// --- Diagram Data ---

export interface DiagramData {
  id: string;
  name: string;
  type: DiagramType;
  elements: DiagramElement[];
  connectors: Connector[];
  viewport: Viewport;
}

// --- Project Data ---

export interface DiagramMeta {
  id: string;
  name: string;
  type: DiagramType;
  parentFolderId: string;
}

export interface ProjectMetadata {
  name: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  /** Diagram ID → metadata (for lazy loading) */
  diagramIndex: Record<string, DiagramMeta>;
}

export interface ProjectTreeNode {
  id: string;
  name: string;
  type: 'folder' | 'diagram';
  diagramType?: DiagramType;
  children?: ProjectTreeNode[];
  expanded?: boolean;
}

export interface ProjectData {
  metadata: ProjectMetadata;
  tree: ProjectTreeNode[];
  sharedElements: Record<string, DiagramElement>;
  diagrams: Record<string, DiagramData>;
  /** Original editor text, including comments and unfinished drafts. Optional for older files. */
  diagramTexts?: Record<string, string>;
}

// --- DSL Parser ---

export type DSLParseResult =
  | { success: true; diagram: DiagramData }
  | { success: false; errors: DSLError[] };

export interface DSLError {
  line: number;
  column: number;
  message: string;
  expected?: string[];
}

// --- Export Engine ---

export interface ExportOptions {
  scale?: number;
  backgroundColor?: string;
  padding?: number;
}

// --- Undo/Redo ---

export interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

// --- Version Management ---

export interface Snapshot {
  id: string;
  createdAt: Date;
  message: string;
  projectDataPath: string;
}

export interface SnapshotEntry {
  id: string;
  createdAt: string;
  message: string;
  /** Snapshot directory path, relative to the project */
  path: string;
}

export interface DiffResult {
  added: DiffEntry[];
  modified: DiffEntry[];
  deleted: DiffEntry[];
  dslTextDiff: TextDiff[];
}

export interface DiffEntry {
  diagramId: string;
  diagramName: string;
  elementChanges: ElementChange[];
}

export interface ElementChange {
  elementId: string;
  type: 'added' | 'modified' | 'deleted';
  before?: DiagramElement;
  after?: DiagramElement;
}

export interface TextDiff {
  diagramId: string;
  diagramName: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
}

// --- Sync Engine ---

export type CanvasChange =
  | { type: 'batch'; changes: CanvasChange[] }
  | { type: 'element-add'; element: DiagramElement }
  | { type: 'element-move'; elementId: string; position: Position }
  | { type: 'element-resize'; elementId: string; size: Size }
  | { type: 'element-delete'; elementId: string }
  | { type: 'element-update'; elementId: string; properties: Partial<ElementProperties> }
  | { type: 'connector-add'; connector: Connector }
  | { type: 'connector-delete'; connectorId: string }
  | { type: 'connector-waypoint'; connectorId: string; waypoints: Position[] };
