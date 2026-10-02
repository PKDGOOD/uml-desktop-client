import type { ProjectData } from '../types';

export function createProject(name: string): ProjectData {
  const now = new Date().toISOString();
  return {
    metadata: { name: name.trim() || 'Untitled Project', version: '1.0.0', createdAt: now, updatedAt: now, diagramIndex: {} },
    tree: [{ id: crypto.randomUUID(), name: name.trim() || 'Untitled Project', type: 'folder', expanded: true, children: [] }],
    diagrams: {}, sharedElements: {}, diagramTexts: {},
  };
}
