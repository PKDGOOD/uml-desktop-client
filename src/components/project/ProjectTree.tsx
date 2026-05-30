// =============================================================================
// ProjectTree - Hierarchical tree view with search, drag-and-drop, CRUD
// =============================================================================

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ProjectTreeNode, DiagramType } from '../../types';

export interface ProjectTreeProps {
  /** Project tree data */
  tree: ProjectTreeNode[];
  /** Currently active diagram ID (for highlighting) */
  activeDiagramId: string | null;
  /** Called when a diagram is double-clicked to open */
  onDiagramOpen: (diagramId: string) => void;
  /** Called when tree structure changes (folder CRUD, drag-and-drop) */
  onTreeChange: (tree: ProjectTreeNode[]) => void;
  /** Called when search result is clicked: open diagram and center element */
  onSearchResultClick?: (diagramId: string, elementName?: string) => void;
  /** Diagram data for element-level search (diagramId → element names) */
  diagramElements?: Record<string, string[]>;
}

// Session storage key for folder expand/collapse state
const STORAGE_KEY_EXPANDED = 'uml-project-tree-expanded';

function getPersistedExpanded(): Set<string> {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY_EXPANDED);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function persistExpanded(expanded: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify([...expanded]));
  } catch { /* ignore */ }
}

function collectDefaultExpanded(nodes: ProjectTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (node: ProjectTreeNode) => {
    if (node.type === 'folder' && node.expanded) {
      ids.push(node.id);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  for (const node of nodes) walk(node);
  return ids;
}

/** Count diagrams under a folder (recursive). */
function countDiagrams(node: ProjectTreeNode): number {
  if (node.type === 'diagram') return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countDiagrams(child), 0);
}

/** Search tree for matching diagrams/elements. */
function searchTree(
  nodes: ProjectTreeNode[],
  query: string,
  diagramElements?: Record<string, string[]>,
): { diagramId: string; name: string; elementName?: string }[] {
  const results: { diagramId: string; name: string; elementName?: string }[] = [];
  const lowerQuery = query.toLowerCase();

  function walk(node: ProjectTreeNode) {
    if (node.type === 'diagram') {
      // Match diagram name
      if (node.name.toLowerCase().includes(lowerQuery)) {
        results.push({ diagramId: node.id, name: node.name });
      }
      // Match element names within diagram
      const elements = diagramElements?.[node.id];
      if (elements) {
        for (const elName of elements) {
          if (elName.toLowerCase().includes(lowerQuery)) {
            results.push({ diagramId: node.id, name: node.name, elementName: elName });
          }
        }
      }
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  }

  for (const node of nodes) walk(node);
  return results;
}

/** Deep clone and update tree nodes. */
function cloneTree(nodes: ProjectTreeNode[]): ProjectTreeNode[] {
  return nodes.map((n) => ({
    ...n,
    children: n.children ? cloneTree(n.children) : undefined,
  }));
}

/** Remove a node by ID from tree, returning [newTree, removedNode]. */
function removeNode(
  nodes: ProjectTreeNode[],
  nodeId: string,
): [ProjectTreeNode[], ProjectTreeNode | null] {
  let removed: ProjectTreeNode | null = null;
  const filtered = nodes.filter((n) => {
    if (n.id === nodeId) {
      removed = n;
      return false;
    }
    return true;
  });
  if (removed) return [filtered, removed];

  // Recurse into children
  const result = filtered.map((n) => {
    if (!n.children) return n;
    const [newChildren, r] = removeNode(n.children, nodeId);
    if (r) removed = r;
    return { ...n, children: newChildren };
  });
  return [result, removed];
}

/** Insert a node into a folder by ID. */
function insertIntoFolder(
  nodes: ProjectTreeNode[],
  folderId: string,
  node: ProjectTreeNode,
): ProjectTreeNode[] {
  return nodes.map((n) => {
    if (n.id === folderId && n.type === 'folder') {
      return { ...n, children: [...(n.children ?? []), node] };
    }
    if (n.children) {
      return { ...n, children: insertIntoFolder(n.children, folderId, node) };
    }
    return n;
  });
}

export const ProjectTree: React.FC<ProjectTreeProps> = ({
  tree,
  activeDiagramId,
  onDiagramOpen,
  onTreeChange,
  onSearchResultClick,
  diagramElements,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(getPersistedExpanded);
  const [searchQuery, setSearchQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded.size > 0) return;
    const defaults = collectDefaultExpanded(tree);
    if (defaults.length > 0) {
      setExpanded(new Set(defaults));
    }
  }, [expanded.size, tree]);

  // Persist expanded state
  useEffect(() => {
    persistExpanded(expanded);
  }, [expanded]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // --- Folder CRUD ---

  const handleCreateFolder = useCallback(
    (parentId: string | null) => {
      const newFolder: ProjectTreeNode = {
        id: `folder-${Date.now()}`,
        name: 'New Folder',
        type: 'folder',
        children: [],
      };
      if (parentId) {
        const newTree = insertIntoFolder(cloneTree(tree), parentId, newFolder);
        onTreeChange(newTree);
        setExpanded((prev) => new Set([...prev, parentId]));
      } else {
        onTreeChange([...cloneTree(tree), newFolder]);
      }
      // Start renaming immediately
      setRenamingId(newFolder.id);
      setRenameValue(newFolder.name);
    },
    [tree, onTreeChange],
  );

  const handleStartRename = useCallback((nodeId: string, currentName: string) => {
    setRenamingId(nodeId);
    setRenameValue(currentName);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (!renamingId || !renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    function rename(nodes: ProjectTreeNode[]): ProjectTreeNode[] {
      return nodes.map((n) => {
        if (n.id === renamingId) return { ...n, name: renameValue.trim() };
        if (n.children) return { ...n, children: rename(n.children) };
        return n;
      });
    }
    onTreeChange(rename(cloneTree(tree)));
    setRenamingId(null);
  }, [renamingId, renameValue, tree, onTreeChange]);

  const handleDeleteFolder = useCallback(
    (nodeId: string, nodeName: string) => {
      if (!window.confirm(`Delete folder "${nodeName}" and all its contents?`)) return;
      const [newTree] = removeNode(cloneTree(tree), nodeId);
      onTreeChange(newTree);
    },
    [tree, onTreeChange],
  );

  // --- Drag and drop ---

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    e.dataTransfer.setData('text/plain', nodeId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverFolderId(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetFolderId: string) => {
      e.preventDefault();
      setDragOverFolderId(null);
      const nodeId = e.dataTransfer.getData('text/plain');
      if (!nodeId || nodeId === targetFolderId) return;

      const treeCopy = cloneTree(tree);
      const [treeWithout, removed] = removeNode(treeCopy, nodeId);
      if (!removed) return;
      const newTree = insertIntoFolder(treeWithout, targetFolderId, removed);
      onTreeChange(newTree);
      setExpanded((prev) => new Set([...prev, targetFolderId]));
    },
    [tree, onTreeChange],
  );

  // --- Search ---

  const searchResults = searchQuery.trim()
    ? searchTree(tree, searchQuery.trim(), diagramElements)
    : [];

  // --- Render tree node ---

  const renderNode = (node: ProjectTreeNode, depth: number) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expanded.has(node.id);
    const isActive = node.id === activeDiagramId;
    const isDragOver = dragOverFolderId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`tree-node${isActive ? ' is-active' : ''}${isDragOver ? ' is-drag-over' : ''}`}
          style={{
            paddingLeft: depth * 16 + 6,
          }}
          onClick={() => {
            if (isFolder) toggleExpand(node.id);
          }}
          onDoubleClick={() => {
            if (!isFolder) onDiagramOpen(node.id);
          }}
          draggable={!isFolder}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={isFolder ? (e) => handleDragOver(e, node.id) : undefined}
          onDragLeave={isFolder ? handleDragLeave : undefined}
          onDrop={isFolder ? (e) => handleDrop(e, node.id) : undefined}
        >
          {/* Expand/collapse icon */}
          {isFolder && (
            <span className="tree-caret">
              {isExpanded ? 'v' : '>'}
            </span>
          )}
          {!isFolder && <span className="tree-caret" />}

          {/* Icon */}
          <span className="tree-icon">{isFolder ? 'F' : node.diagramType?.slice(0, 1).toUpperCase() ?? 'D'}</span>

          {/* Name or rename input */}
          {renamingId === node.id ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleFinishRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFinishRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              className="field-input"
              style={{ flex: 1, minHeight: 24 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tree-name">{node.name}</span>
          )}

          {/* Diagram count for folders */}
          {isFolder && (
            <span className="tree-count">
              ({countDiagrams(node)})
            </span>
          )}

          {/* Folder actions */}
          {isFolder && renamingId !== node.id && (
            <span className="tree-actions">
              <button
                onClick={(e) => { e.stopPropagation(); handleCreateFolder(node.id); }}
                className="tree-action-button"
                title="New subfolder"
              >+</button>
              <button
                onClick={(e) => { e.stopPropagation(); handleStartRename(node.id, node.name); }}
                className="tree-action-button"
                title="Rename"
              >Ren</button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(node.id, node.name); }}
                className="tree-action-button"
                title="Delete"
              >×</button>
            </span>
          )}
        </div>

        {/* Children */}
        {isFolder && isExpanded && (node.children ?? []).map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="tree-root">
      <div className="panel-header">
        <div className="panel-title">Project</div>
        <button
          onClick={() => handleCreateFolder(null)}
          className="tree-action-button"
          title="New folder"
        >
          +
        </button>
      </div>
      {/* Search input */}
      <div className="tree-search">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search diagrams & elements..."
        />
      </div>

      {/* Search results */}
      {searchQuery.trim() && (
        <div className="search-results">
          {searchResults.length === 0 ? (
            <div className="search-result">No results</div>
          ) : (
            searchResults.map((r, i) => (
              <div
                key={`${r.diagramId}-${r.elementName ?? ''}-${i}`}
                onClick={() => onSearchResultClick?.(r.diagramId, r.elementName)}
                className="search-result"
              >
                <div>{r.name}</div>
                {r.elementName && (
                  <div className="search-result-subtitle">in {r.elementName}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tree */}
      <div className="tree-list">
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
};
