import { create } from 'zustand';
import type {
  DiagramData,
  DiagramElement,
  Connector,
  Position,
  Size,
  ElementProperties,
} from '../types';

export interface DiagramStoreState {
  /** Currently active diagram data */
  diagram: DiagramData | null;

  /** Set the active diagram */
  setDiagram: (diagram: DiagramData) => void;
  /** Add an element to the current diagram */
  addElement: (element: DiagramElement) => void;
  /** Move an element to a new position */
  moveElement: (elementId: string, position: Position) => void;
  /** Resize an element */
  resizeElement: (elementId: string, size: Size) => void;
  /** Update element properties (partial merge) */
  updateElementProperties: (elementId: string, properties: Partial<ElementProperties>) => void;
  /** Delete an element and all connected connectors (cascade) */
  deleteElement: (elementId: string) => void;
  /** Add a connector */
  addConnector: (connector: Connector) => void;
  /** Delete a connector */
  deleteConnector: (connectorId: string) => void;
  /** Update connector waypoints */
  updateConnectorWaypoints: (connectorId: string, waypoints: Position[]) => void;
  /** Get current diagram data */
  getDiagram: () => DiagramData | null;
  /** Reset the store */
  reset: () => void;
}

export const useDiagramStore = create<DiagramStoreState>((set, get) => ({
  diagram: null,

  setDiagram: (diagram) => set({ diagram }),

  addElement: (element) =>
    set((state) => {
      if (!state.diagram) return state;
      return {
        diagram: {
          ...state.diagram,
          elements: [...state.diagram.elements, element],
        },
      };
    }),

  moveElement: (elementId, position) =>
    set((state) => {
      if (!state.diagram) return state;
      return {
        diagram: {
          ...state.diagram,
          elements: state.diagram.elements.map((el) =>
            el.id === elementId ? { ...el, position } : el,
          ),
        },
      };
    }),

  resizeElement: (elementId, size) =>
    set((state) => {
      if (!state.diagram) return state;
      return {
        diagram: {
          ...state.diagram,
          elements: state.diagram.elements.map((el) =>
            el.id === elementId ? { ...el, size } : el,
          ),
        },
      };
    }),

  updateElementProperties: (elementId, properties) =>
    set((state) => {
      if (!state.diagram) return state;
      return {
        diagram: {
          ...state.diagram,
          elements: state.diagram.elements.map((el) =>
            el.id === elementId
              ? { ...el, properties: { ...el.properties, ...properties } }
              : el,
          ),
        },
      };
    }),

  deleteElement: (elementId) =>
    set((state) => {
      if (!state.diagram) return state;
      // Cascade: remove all connectors where this element is source or target
      const connectors = state.diagram.connectors.filter(
        (c) => c.sourceId !== elementId && c.targetId !== elementId,
      );
      const elements = state.diagram.elements.filter((el) => el.id !== elementId);
      return {
        diagram: {
          ...state.diagram,
          elements,
          connectors,
        },
      };
    }),

  addConnector: (connector) =>
    set((state) => {
      if (!state.diagram) return state;
      return {
        diagram: {
          ...state.diagram,
          connectors: [...state.diagram.connectors, connector],
        },
      };
    }),

  deleteConnector: (connectorId) =>
    set((state) => {
      if (!state.diagram) return state;
      return {
        diagram: {
          ...state.diagram,
          connectors: state.diagram.connectors.filter((c) => c.id !== connectorId),
        },
      };
    }),

  updateConnectorWaypoints: (connectorId, waypoints) =>
    set((state) => {
      if (!state.diagram) return state;
      return {
        diagram: {
          ...state.diagram,
          connectors: state.diagram.connectors.map((c) =>
            c.id === connectorId ? { ...c, waypoints } : c,
          ),
        },
      };
    }),

  getDiagram: () => get().diagram,

  reset: () => set({ diagram: null }),
}));
