// =============================================================================
// PropertyPanel - Editable properties for selected diagram element
// =============================================================================

import React, { useState, useCallback } from 'react';
import type { DiagramElement, Attribute, Method, ElementProperties } from '../../types';

export interface PropertyPanelProps {
  /** Currently selected element (null if nothing selected) */
  element: DiagramElement | null;
  /** Called when a property is changed */
  onPropertyChange: (elementId: string, properties: Partial<ElementProperties>) => void;
  /** For Shared_Element: list of diagram names referencing this element */
  referencingDiagrams?: { id: string; name: string }[];
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  element,
  onPropertyChange,
  referencingDiagrams = [],
}) => {
  const [attributesExpanded, setAttributesExpanded] = useState(true);
  const [methodsExpanded, setMethodsExpanded] = useState(true);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!element) return;
      onPropertyChange(element.id, { name: e.target.value });
    },
    [element, onPropertyChange],
  );

  const handleStereotypeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!element) return;
      onPropertyChange(element.id, { stereotype: e.target.value });
    },
    [element, onPropertyChange],
  );

  const handleVisibilityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!element) return;
      onPropertyChange(element.id, {
        visibility: e.target.value as ElementProperties['visibility'],
      });
    },
    [element, onPropertyChange],
  );

  // --- Attribute editing ---

  const handleAttributeChange = useCallback(
    (index: number, field: keyof Attribute, value: string) => {
      if (!element?.properties.attributes) return;
      const updated = [...element.properties.attributes];
      updated[index] = { ...updated[index], [field]: value };
      onPropertyChange(element.id, { attributes: updated });
    },
    [element, onPropertyChange],
  );

  const handleAddAttribute = useCallback(() => {
    if (!element) return;
    const attrs = [...(element.properties.attributes ?? [])];
    attrs.push({ name: 'newAttr', type: 'string', visibility: 'private' });
    onPropertyChange(element.id, { attributes: attrs });
  }, [element, onPropertyChange]);

  const handleRemoveAttribute = useCallback(
    (index: number) => {
      if (!element?.properties.attributes) return;
      const updated = element.properties.attributes.filter((_, i) => i !== index);
      onPropertyChange(element.id, { attributes: updated });
    },
    [element, onPropertyChange],
  );

  // --- Method editing ---

  const handleMethodChange = useCallback(
    (index: number, field: keyof Method, value: string) => {
      if (!element?.properties.methods) return;
      const updated = [...element.properties.methods];
      updated[index] = { ...updated[index], [field]: value } as Method;
      onPropertyChange(element.id, { methods: updated });
    },
    [element, onPropertyChange],
  );

  const handleAddMethod = useCallback(() => {
    if (!element) return;
    const methods = [...(element.properties.methods ?? [])];
    methods.push({
      name: 'newMethod',
      returnType: 'void',
      parameters: [],
      visibility: 'public',
    });
    onPropertyChange(element.id, { methods });
  }, [element, onPropertyChange]);

  const handleRemoveMethod = useCallback(
    (index: number) => {
      if (!element?.properties.methods) return;
      const updated = element.properties.methods.filter((_, i) => i !== index);
      onPropertyChange(element.id, { methods: updated });
    },
    [element, onPropertyChange],
  );

  if (!element) {
    return (
      <div style={{ padding: 12, color: '#888', fontSize: 13 }}>
        No element selected
      </div>
    );
  }

  const { properties } = element;
  const hasAttributes = ['class', 'interface', 'abstract-class', 'enum'].includes(element.type);
  const hasMethods = ['class', 'interface', 'abstract-class'].includes(element.type);

  return (
    <div style={{ padding: 8, fontSize: 13, overflowY: 'auto', height: '100%' }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Properties</div>

      {/* Name */}
      <label style={labelStyle}>Name</label>
      <input
        value={properties.name}
        onChange={handleNameChange}
        style={inputStyle}
      />

      {/* Type (read-only) */}
      <label style={labelStyle}>Type</label>
      <div style={{ ...inputStyle, background: '#f5f5f5', cursor: 'default' }}>
        {element.type}
      </div>

      {/* Stereotype */}
      <label style={labelStyle}>Stereotype</label>
      <input
        value={properties.stereotype ?? ''}
        onChange={handleStereotypeChange}
        placeholder="e.g. «entity»"
        style={inputStyle}
      />

      {/* Visibility */}
      <label style={labelStyle}>Visibility</label>
      <select
        value={properties.visibility ?? 'public'}
        onChange={handleVisibilityChange}
        style={inputStyle}
      >
        <option value="public">public (+)</option>
        <option value="private">private (-)</option>
        <option value="protected">protected (#)</option>
        <option value="package">package (~)</option>
      </select>

      {/* Attributes section */}
      {hasAttributes && (
        <>
          <div
            onClick={() => setAttributesExpanded((v) => !v)}
            style={sectionHeaderStyle}
          >
            {attributesExpanded ? '▾' : '▸'} Attributes ({properties.attributes?.length ?? 0})
          </div>
          {attributesExpanded && (
            <div style={{ marginLeft: 8 }}>
              {(properties.attributes ?? []).map((attr, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input
                    value={attr.name}
                    onChange={(e) => handleAttributeChange(i, 'name', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="name"
                  />
                  <input
                    value={attr.type}
                    onChange={(e) => handleAttributeChange(i, 'type', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="type"
                  />
                  <button onClick={() => handleRemoveAttribute(i)} style={removeButtonStyle}>
                    ×
                  </button>
                </div>
              ))}
              <button onClick={handleAddAttribute} style={addButtonStyle}>
                + Add Attribute
              </button>
            </div>
          )}
        </>
      )}

      {/* Methods section */}
      {hasMethods && (
        <>
          <div
            onClick={() => setMethodsExpanded((v) => !v)}
            style={sectionHeaderStyle}
          >
            {methodsExpanded ? '▾' : '▸'} Methods ({properties.methods?.length ?? 0})
          </div>
          {methodsExpanded && (
            <div style={{ marginLeft: 8 }}>
              {(properties.methods ?? []).map((method, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                  <input
                    value={method.name}
                    onChange={(e) => handleMethodChange(i, 'name', e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="name"
                  />
                  <input
                    value={method.returnType}
                    onChange={(e) => handleMethodChange(i, 'returnType', e.target.value)}
                    style={{ ...inputStyle, width: 60 }}
                    placeholder="return"
                  />
                  <button onClick={() => handleRemoveMethod(i)} style={removeButtonStyle}>
                    ×
                  </button>
                </div>
              ))}
              <button onClick={handleAddMethod} style={addButtonStyle}>
                + Add Method
              </button>
            </div>
          )}
        </>
      )}

      {/* Shared element referencing diagrams */}
      {element.sharedRefId && referencingDiagrams.length > 0 && (
        <>
          <div style={{ ...sectionHeaderStyle, marginTop: 12 }}>
            Referencing Diagrams ({referencingDiagrams.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
            {referencingDiagrams.map((d) => (
              <li key={d.id} style={{ marginBottom: 2 }}>
                {d.name}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

// --- Styles ---

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: '#666',
  marginTop: 8,
  marginBottom: 2,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: 12,
  border: '1px solid #ccc',
  borderRadius: 3,
  boxSizing: 'border-box',
};

const sectionHeaderStyle: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 4,
  fontWeight: 600,
  fontSize: 12,
  cursor: 'pointer',
  userSelect: 'none',
};

const addButtonStyle: React.CSSProperties = {
  padding: '2px 8px',
  fontSize: 11,
  border: '1px solid #ccc',
  borderRadius: 3,
  background: '#fff',
  cursor: 'pointer',
  marginTop: 4,
};

const removeButtonStyle: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 14,
  border: '1px solid #ccc',
  borderRadius: 3,
  background: '#fff',
  cursor: 'pointer',
  color: '#c00',
  lineHeight: 1,
};
