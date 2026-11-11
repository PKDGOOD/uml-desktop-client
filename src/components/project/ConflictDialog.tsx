import React, { useEffect, useRef, useState } from 'react';
import type { DiagramData } from '../../types';
import type { ConflictChoice, TextModelConflict } from '../../engine/textModelConflicts';

function summary(diagram: DiagramData): string {
  const elements = diagram.elements.length;
  const connectors = diagram.connectors.length;
  return `${elements} element${elements === 1 ? '' : 's'}, ${connectors} connection${connectors === 1 ? '' : 's'}`;
}

/**
 * A03.09: the file stores DSL text and a diagram that disagree. Nothing is
 * chosen for the user; Open stays disabled until every diagram has a choice,
 * and Cancel keeps the current project.
 */
export function ConflictDialog({ conflicts, onCancel, onOpen }: {
  conflicts: TextModelConflict[];
  onCancel: () => void;
  onOpen: (choices: Record<string, ConflictChoice>) => void;
}) {
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>({});
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const complete = conflicts.every((conflict) => choices[conflict.diagramId]);
  return <dialog ref={ref} className="create-dialog" onCancel={(event) => { event.preventDefault(); onCancel(); }} aria-labelledby="conflict-title">
    <form onSubmit={(event) => { event.preventDefault(); if (complete) onOpen(choices); }}>
      <h2 id="conflict-title">Text and diagram disagree</h2>
      <p className="history-help">
        This file stores DSL text and a diagram that mean different things for {conflicts.length === 1 ? 'one diagram' : `${conflicts.length} diagrams`}.
        Choose which to keep for each. The project opens unsaved; the file does not change until you save.
      </p>
      {conflicts.map((conflict) => {
        const name = `conflict-${conflict.diagramId}`;
        return <fieldset key={conflict.diagramId} className="conflict-choice">
          <legend>{conflict.diagramName}</legend>
          <label>
            <input type="radio" name={name} checked={choices[conflict.diagramId] === 'text'}
              onChange={() => setChoices((current) => ({ ...current, [conflict.diagramId]: 'text' }))} />
            {' '}Use the text ({summary(conflict.textModel)})
          </label>
          <label>
            <input type="radio" name={name} checked={choices[conflict.diagramId] === 'model'}
              onChange={() => setChoices((current) => ({ ...current, [conflict.diagramId]: 'model' }))} />
            {' '}Use the diagram ({summary(conflict.model)})
          </label>
        </fieldset>;
      })}
      <div className="dialog-actions">
        <button type="button" className="menu-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="menu-button" disabled={!complete}>Open</button>
      </div>
    </form>
  </dialog>;
}
