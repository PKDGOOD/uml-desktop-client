// =============================================================================
// Stored text/model conflicts (A03.09, ADR 0001 §5)
//
// A diagram stores its DSL text and its last valid model. When the text parses
// and meets the diagram rules but means something else than the model, neither
// is opened silently: the user picks one per diagram, and the project opens
// unsaved so the file on disk keeps both until they save.
// =============================================================================

import type { DiagramData, ProjectData } from '../types';
import { serializeDSL } from '../parser/dsl/serializer';
import { renameDiagramHeader } from '../parser/dsl/diagramHeader';
import { parseCheckedDSL } from './diagramRules';
import { preserveIds } from './syncEngine';

export interface TextModelConflict {
  diagramId: string;
  diagramName: string;
  /** The stored model, as saved. */
  model: DiagramData;
  /** The stored text, as saved. */
  text: string;
  /** What the stored text parses to, with IDs matched to the model (ADR 0002 §2, §6). */
  textModel: DiagramData;
}

export type ConflictChoice = 'text' | 'model';

/**
 * "Same meaning" is the DSL the model and the text candidate write: anything
 * the DSL can say must agree, while comments, spacing and model-only data
 * (IDs, waypoints, viewport) do not count.
 */
function sameMeaning(a: DiagramData, b: DiagramData): boolean {
  return serializeDSL(a) === serializeDSL(b);
}

/**
 * Diagrams whose stored text is valid but disagrees with the stored model. A
 * text that does not parse or breaks a rule is a marked draft, not a conflict.
 */
export function findTextModelConflicts(project: ProjectData): TextModelConflict[] {
  const conflicts: TextModelConflict[] = [];
  for (const [id, model] of Object.entries(project.diagrams)) {
    const text = project.diagramTexts?.[id];
    if (text === undefined) continue;
    const parsed = parseCheckedDSL(text);
    if (!parsed.success) continue;
    const textModel = parsed.diagram;
    preserveIds(model, textModel);
    // The tree owns the diagram name; a stale header is renamed, not a conflict.
    textModel.name = model.name;
    if (!sameMeaning(model, textModel)) {
      conflicts.push({ diagramId: id, diagramName: model.name, model: structuredClone(model), text, textModel });
    }
  }
  return conflicts;
}

/**
 * Apply one choice per conflict to a copy of the project. Choosing the text
 * replaces the model with what the text means; choosing the model replaces the
 * text with the DSL the model writes. Every conflict needs a choice.
 */
export function resolveTextModelConflicts(
  project: ProjectData,
  conflicts: TextModelConflict[],
  choices: Record<string, ConflictChoice>,
): ProjectData {
  const resolved = structuredClone(project);
  resolved.diagramTexts = { ...(resolved.diagramTexts ?? {}) };
  for (const conflict of conflicts) {
    const choice = choices[conflict.diagramId];
    if (choice === 'text') {
      resolved.diagrams[conflict.diagramId] = structuredClone(conflict.textModel);
      resolved.diagramTexts[conflict.diagramId] = renameDiagramHeader(conflict.text, conflict.diagramName);
    } else if (choice === 'model') {
      resolved.diagramTexts[conflict.diagramId] = serializeDSL(resolved.diagrams[conflict.diagramId]);
    } else {
      throw new Error(`Choose the text or the diagram for ${JSON.stringify(conflict.diagramName)}`);
    }
  }
  return resolved;
}
