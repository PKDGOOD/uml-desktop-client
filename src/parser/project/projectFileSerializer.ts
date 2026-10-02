import type { ProjectData } from '@/types';

export const ProjectFileSerializer = {
  /**
   * Serialize ProjectData to a JSON string.
   * Preserves shared element references (sharedRefId on elements).
   */
  serialize(project: ProjectData): string {
    return JSON.stringify(
      {
        metadata: project.metadata,
        tree: project.tree,
        sharedElements: project.sharedElements,
        diagrams: project.diagrams,
        diagramTexts: project.diagramTexts,
      },
      null,
      2,
    );
  },
};
