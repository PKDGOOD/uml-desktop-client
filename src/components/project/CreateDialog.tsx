import React, { useEffect, useRef, useState } from 'react';
import type { DiagramType, ProjectTreeNode } from '../../types';

export const DIAGRAM_LABELS: Record<DiagramType, string> = {
  class: 'Class', sequence: 'Sequence', usecase: 'Use Case', activity: 'Activity', state: 'State',
};

export function CreateDialog({ mode, tree, onCancel, onCreate }: {
  mode: 'project' | 'diagram'; tree: ProjectTreeNode[];
  onCancel: () => void; onCreate: (name: string, type: DiagramType, folderId: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DiagramType>('class');
  const [folder, setFolder] = useState(tree.find((node) => node.type === 'folder')?.id ?? '');
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const folders: { id: string; label: string }[] = [];
  const visit = (nodes: ProjectTreeNode[], prefix = '') => {
    for (const node of nodes) if (node.type === 'folder') {
      const label = `${prefix}${node.name}`;
      folders.push({ id: node.id, label });
      visit(node.children ?? [], `${label} / `);
    }
  };
  visit(tree);
  return <dialog ref={ref} className="create-dialog" onCancel={onCancel} aria-labelledby="create-title">
    <form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onCreate(name.trim(), type, folder); }}>
      <h2 id="create-title">New {mode === 'project' ? 'project' : 'diagram'}</h2>
      <label className="field-label" htmlFor="create-name">Name</label>
      <input autoFocus id="create-name" className="field-input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} placeholder={mode === 'project' ? 'My project' : 'Order system'} />
      {mode === 'diagram' && <>
        <label className="field-label" htmlFor="create-type">Diagram type</label>
        <select id="create-type" className="field-select" value={type} onChange={(event) => setType(event.target.value as DiagramType)}>
          {Object.entries(DIAGRAM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="field-label" htmlFor="create-folder">Folder</label>
        <select id="create-folder" className="field-select" value={folder} onChange={(event) => setFolder(event.target.value)}>
          <option value="">Project root</option>
          {folders.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </>}
      <div className="dialog-actions">
        <button type="button" className="menu-button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="menu-button" disabled={!name.trim()}>Create</button>
      </div>
    </form>
  </dialog>;
}
