// =============================================================================
// PropertyPanel - Editable properties for selected diagram element
// =============================================================================

import React, { useState, useCallback, useEffect } from 'react';
import type { DiagramElement, Attribute, Method, ElementProperties } from '../../types';

export interface PropertyPanelProps {
  /** Currently selected element (null if nothing selected) */
  element: DiagramElement | null;
  /** Called when a property is changed */
  onPropertyChange: (elementId: string, properties: Partial<ElementProperties>) => void;
  /** For Shared_Element: list of diagram names referencing this element */
  referencingDiagrams?: { id: string; name: string }[];
  /** Fields cannot be edited, for example while the DSL text has errors. */
  disabled?: boolean;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  element,
  onPropertyChange,
  referencingDiagrams = [],
  disabled = false,
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

  // A stereotype is committed on blur or Enter, without surrounding spaces; an empty
  // field removes it. Committing per keystroke would refuse "my " while typing "my entity".
  const [stereotypeDraft, setStereotypeDraft] = useState(element?.properties.stereotype ?? '');
  useEffect(() => {
    setStereotypeDraft(element?.properties.stereotype ?? '');
  }, [element?.id, element?.properties.stereotype]);

  const commitStereotype = useCallback(() => {
    if (!element) return;
    const value = stereotypeDraft.trim();
    if (value === (element.properties.stereotype ?? '')) {
      setStereotypeDraft(value);
      return;
    }
    onPropertyChange(element.id, { stereotype: value === '' ? undefined : value });
  }, [element, onPropertyChange, stereotypeDraft]);

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
    // An enum value is only a name in the DSL.
    attrs.push(element.type === 'enum'
      ? { name: `VALUE${attrs.length + 1}`, type: '', visibility: 'public' }
      : { name: 'newAttr', type: 'string', visibility: 'private' });
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
      <div className="property-panel">
        <div className="panel-header">
          <div className="panel-title">Properties</div>
        </div>
        <div className="empty-panel">
          <div className="empty-panel-title">No element selected</div>
          <div>Select a shape on the canvas to edit its name, visibility, attributes, and methods.</div>
        </div>
      </div>
    );
  }

  const { properties } = element;
  const hasAttributes = ['class', 'interface', 'abstract-class', 'enum'].includes(element.type);
  const hasMethods = ['class', 'interface', 'abstract-class'].includes(element.type);

  return (
    <div className="property-panel">
      <div className="panel-header">
        <div className="panel-title">Properties</div>
        <div className="panel-title">{element.type}</div>
      </div>
      {disabled && <div className="panel-note" role="status">Fix the DSL errors to edit properties.</div>}
      <fieldset className="property-body" disabled={disabled} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>

      {/* Name */}
      <label className="field-label">Name</label>
      <input
        value={properties.name}
        onChange={handleNameChange}
        className="field-input"
      />

      {/* Type (read-only) */}
      <label className="field-label">Type</label>
      <div className="field-input" style={{ background: '#eef2f7', cursor: 'default' }}>
        {element.type}
      </div>

      {/* Stereotype */}
      <label className="field-label">Stereotype</label>
      <input
        value={stereotypeDraft}
        onChange={(e) => setStereotypeDraft(e.target.value)}
        onBlur={commitStereotype}
        onKeyDown={(e) => { if (e.key === 'Enter') commitStereotype(); }}
        placeholder="e.g. «entity»"
        className="field-input"
      />

      {/* Visibility */}
      <label className="field-label">Visibility</label>
      <select
        value={properties.visibility ?? 'public'}
        onChange={handleVisibilityChange}
        className="field-select"
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
            className="section-header"
          >
            <span>{attributesExpanded ? 'v' : '>'} Attributes</span>
            <span>{properties.attributes?.length ?? 0}</span>
          </div>
          {attributesExpanded && (
            <div>
              {(properties.attributes ?? []).map((attr, i) => (
                <div key={i} className="property-row">
                  <input
                    value={attr.name}
                    onChange={(e) => handleAttributeChange(i, 'name', e.target.value)}
                    className="field-input"
                    style={{ flex: 1 }}
                    placeholder="name"
                  />
                  {element.type !== 'enum' && (
                    <input
                      value={attr.type}
                      onChange={(e) => handleAttributeChange(i, 'type', e.target.value)}
                      className="field-input"
                      style={{ flex: 1 }}
                      placeholder="type"
                    />
                  )}
                  <button onClick={() => handleRemoveAttribute(i)} className="panel-button danger">
                    ×
                  </button>
                </div>
              ))}
              <button onClick={handleAddAttribute} className="panel-button">
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
            className="section-header"
          >
            <span>{methodsExpanded ? 'v' : '>'} Methods</span>
            <span>{properties.methods?.length ?? 0}</span>
          </div>
          {methodsExpanded && (
            <div>
              {(properties.methods ?? []).map((method, i) => (
                <div key={i} className="property-row">
                  <input
                    value={method.name}
                    onChange={(e) => handleMethodChange(i, 'name', e.target.value)}
                    className="field-input"
                    style={{ flex: 1 }}
                    placeholder="name"
                  />
                  <input
                    value={method.returnType}
                    onChange={(e) => handleMethodChange(i, 'returnType', e.target.value)}
                    className="field-input"
                    style={{ width: 70 }}
                    placeholder="return"
                  />
                  <button onClick={() => handleRemoveMethod(i)} className="panel-button danger">
                    ×
                  </button>
                </div>
              ))}
              <button onClick={handleAddMethod} className="panel-button">
                + Add Method
              </button>
            </div>
          )}
        </>
      )}

      {/* Shared element referencing diagrams */}
      {element.sharedRefId && referencingDiagrams.length > 0 && (
        <>
          <div className="section-header">
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
      </fieldset>
    </div>
  );
};
