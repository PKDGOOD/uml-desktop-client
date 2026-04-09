import { create } from 'zustand';
import type { ProjectMetadata, ProjectTreeNode } from '../types';

export type { ProjectMetadata, ProjectTreeNode };
export type { DiagramMeta, DiagramType } from '../types';

export interface ProjectStoreState {
  /** Project metadata */
  metadata: ProjectMetadata | null;
  /** Project tree structure */
  tree: ProjectTreeNode[];
  /** IDs of currently open diagram tabs */
  openDiagramIds: string[];
  /** Currently active diagram tab ID */
  activeDiagramId: string | null;
  /** Whether the project has unsaved changes */
  dirty: boolean;

  /** Actions */
  setMetadata: (metadata: ProjectMetadata) => void;
  setTree: (tree: ProjectTreeNode[]) => void;
  openDiagram: (diagramId: string) => void;
  closeDiagram: (diagramId: string) => void;
  setActiveDiagram: (diagramId: string | null) => void;
  setDirty: (dirty: boolean) => void;
  reset: () => void;
}

const initialState = {
  metadata: null,
  tree: [],
  openDiagramIds: [],
  activeDiagramId: null,
  dirty: false,
};

export const useProjectStore = create<ProjectStoreState>((set) => ({
  ...initialState,

  setMetadata: (metadata) => set({ metadata }),

  setTree: (tree) => set({ tree }),

  openDiagram: (diagramId) =>
    set((state) => {
      if (state.openDiagramIds.includes(diagramId)) {
        return { activeDiagramId: diagramId };
      }
      return {
        openDiagramIds: [...state.openDiagramIds, diagramId],
        activeDiagramId: diagramId,
      };
    }),

  closeDiagram: (diagramId) =>
    set((state) => {
      const newOpenIds = state.openDiagramIds.filter((id) => id !== diagramId);
      const newActiveId =
        state.activeDiagramId === diagramId
          ? newOpenIds[newOpenIds.length - 1] ?? null
          : state.activeDiagramId;
      return {
        openDiagramIds: newOpenIds,
        activeDiagramId: newActiveId,
      };
    }),

  setActiveDiagram: (diagramId) => set({ activeDiagramId: diagramId }),

  setDirty: (dirty) => set({ dirty }),

  reset: () => set(initialState),
}));
