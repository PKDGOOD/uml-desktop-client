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
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '3px 6px',
            paddingLeft: depth * 16 + 6,
            fontSize: 12,
            cursor: 'pointer',
            background: isActive ? '#e3f2fd' : isDragOver ? '#f0f0f0' : 'transparent',
            borderLeft: isActive ? '3px solid #1976D2' : '3px solid transparent',
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
            <span style={{ marginRight: 4, fontSize: 10, width: 12 }}>
              {isExpanded ? '▾' : '▸'}
            </span>
          )}
          {!isFolder && <span style={{ marginRight: 4, width: 12 }} />}

          {/* Icon */}
          <span style={{ marginRight: 4 }}>{isFolder ? '📁' : '📄'}</span>

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
              style={{ fontSize: 12, border: '1px solid #1976D2', borderRadius: 2, padding: '1px 4px', flex: 1 }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span style={{ flex: 1 }}>{node.name}</span>
          )}

          {/* Diagram count for folders */}
          {isFolder && (
            <span style={{ fontSize: 10, color: '#999', marginLeft: 4 }}>
              ({countDiagrams(node)})
            </span>
          )}

          {/* Folder actions */}
          {isFolder && renamingId !== node.id && (
            <span style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleCreateFolder(node.id); }}
                style={treeActionBtnStyle}
                title="New subfolder"
              >+</button>
              <button
                onClick={(e) => { e.stopPropagation(); handleStartRename(node.id, node.name); }}
                style={treeActionBtnStyle}
                title="Rename"
              >✎</button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(node.id, node.name); }}
                style={treeActionBtnStyle}
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 13 }}>
      {/* Search input */}
      <div style={{ padding: 6, borderBottom: '1px solid #eee' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search diagrams & elements..."
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: 12,
            border: '1px solid #ccc',
            borderRadius: 3,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Search results */}
      {searchQuery.trim() && (
        <div style={{ borderBottom: '1px solid #eee', maxHeight: 200, overflowY: 'auto' }}>
          {searchResults.length === 0 ? (
            <div style={{ padding: 8, fontSize: 12, color: '#888' }}>No results</div>
          ) : (
            searchResults.map((r, i) => (
              <div
                key={`${r.diagramId}-${r.elementName ?? ''}-${i}`}
                onClick={() => onSearchResultClick?.(r.diagramId, r.elementName)}
                style={{
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  borderBottom: '1px solid #f5f5f5',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                <div>{r.name}</div>
                {r.elementName && (
                  <div style={{ fontSize: 11, color: '#666' }}>→ {r.elementName}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* Root-level create folder button */}
        <div style={{ padding: '2px 6px', marginBottom: 4 }}>
          <button
            onClick={() => handleCreateFolder(null)}
            style={{ ...treeActionBtnStyle, fontSize: 11, padding: '2px 8px' }}
          >
            + New Folder
          </button>
        </div>
        {tree.map((node) => renderNode(node, 0))}
      </div>
    </div>
  );
};

const treeActionBtnStyle: React.CSSProperties = {
  padding: '1px 4px',
  fontSize: 11,
  border: '1px solid #ddd',
  borderRadius: 2,
  background: '#fff',
  cursor: 'pointer',
  lineHeight: 1,
};
