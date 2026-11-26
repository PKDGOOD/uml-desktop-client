// =============================================================================
// PropertyPanel - Editable properties for selected diagram element
// =============================================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { changesFrom, draftFrom, isDirty, localProblem, moveItem, unusedName, type FormDraft } from './formDraft';
import type { PendingFormGuard } from './pendingForm';
import type { DiagramElement, Attribute, Method, Parameter, ElementProperties } from '../../types';

const VISIBILITIES = [
  { value: 'public', mark: '+' },
  { value: 'private', mark: '-' },
  { value: 'protected', mark: '#' },
  { value: 'package', mark: '~' },
] as const;

export interface PropertyPanelProps {
  /** Currently selected element (null if nothing selected) */
  element: DiagramElement | null;
  /**
   * Called once when the user applies the form. Returns why it was refused, or
   * null when it was applied.
   */
  onPropertyChange: (elementId: string, properties: Partial<ElementProperties>) => string | null | void;
  /** For Shared_Element: list of diagram names referencing this element */
  referencingDiagrams?: { id: string; name: string }[];
  /**
   * Ownership (A05.07): the current owner (null: top level) and the owners the element may be given.
   * Choosing one is its own edit, so it is offered only while the form has nothing unapplied.
   */
  owner?: { parentId: string | null; choices: { id: string; name: string }[] };
  /** Applies a new owner; returns why it was refused, or null. */
  onParentChange?: (elementId: string, parentId: string | null) => string | null | void;
  /** Fields cannot be edited, for example while the DSL text has errors. */
  disabled?: boolean;
  /** Lets the app settle a dirty form before it changes selection or saves. */
  registerGuard?: (guard: PendingFormGuard | null) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  element,
  onPropertyChange,
  referencingDiagrams = [],
  owner,
  onParentChange,
  disabled = false,
  registerGuard,
}) => {
  const [attributesExpanded, setAttributesExpanded] = useState(true);
  const [methodsExpanded, setMethodsExpanded] = useState(true);

  // Typing edits a draft; nothing reaches the model until Apply (A05.01).
  const [draft, setDraft] = useState<FormDraft | null>(element ? draftFrom(element.properties) : null);
  const [problem, setProblem] = useState<{ field?: 'name'; message: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const dirty = !!element && !!draft && isDirty(element.properties, draft);

  // Whenever the saved element changes (another selection, Apply, undo, a text edit) the draft is
  // reloaded from it, so a stale draft can never be applied over a newer model.
  const savedKey = element ? `${element.id}:${JSON.stringify(element.properties)}` : '';
  useEffect(() => {
    setDraft(element ? draftFrom(element.properties) : null);
    setProblem(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const update = useCallback((change: Partial<FormDraft>) => {
    setDraft((current) => (current ? { ...current, ...change } : current));
    setProblem(null);
  }, []);

  /** Applies the draft; returns why it was refused, or null. */
  const apply = useCallback((): string | null => {
    if (!element || !draft) return null;
    const local = localProblem(draft);
    const refusal = local ? local.message : (() => {
      const changes = changesFrom(element.properties, draft);
      return Object.keys(changes).length === 0 ? null : onPropertyChange(element.id, changes) ?? null;
    })();
    if (refusal) {
      setProblem({ field: local?.field ?? (/name/i.test(refusal) ? 'name' : undefined), message: refusal });
      return refusal;
    }
    setProblem(null);
    return null;
  }, [element, draft, onPropertyChange]);

  const cancel = useCallback(() => {
    if (!element) return;
    setDraft(draftFrom(element.properties));
    setProblem(null);
  }, [element]);

  const discard = useCallback(() => {
    setDraft(element ? draftFrom(element.properties) : null);
    setProblem(null);
  }, [element]);

  useEffect(() => {
    if (!registerGuard) return;
    registerGuard(element && draft ? {
      label: element.properties.name,
      isDirty: () => isDirty(element.properties, draft),
      apply,
      discard,
    } : null);
  }, [registerGuard, element, draft, apply, discard]);
  useEffect(() => () => registerGuard?.(null), [registerGuard]);

  // An invalid Apply moves focus to the field at fault, or to the message.
  useEffect(() => {
    if (!problem) return;
    (problem.field === 'name' ? nameRef.current : alertRef.current)?.focus();
  }, [problem]);

  // --- Attribute editing ---

  const handleAttributeChange = (index: number, field: keyof Attribute, value: string) => {
    if (!draft) return;
    const updated = [...draft.attributes];
    updated[index] = { ...updated[index], [field]: value };
    update({ attributes: updated });
  };

  const handleAddAttribute = () => {
    if (!draft || !element) return;
    const attrs = [...draft.attributes];
    // An enum value is only a name in the DSL.
    attrs.push(element.type === 'enum'
      ? { name: `VALUE${attrs.length + 1}`, type: '', visibility: 'public' }
      : { name: 'newAttr', type: 'string', visibility: 'private' });
    update({ attributes: attrs });
  };

  const handleRemoveAttribute = (index: number) => {
    if (!draft) return;
    update({ attributes: draft.attributes.filter((_, i) => i !== index) });
  };

  // --- Method editing ---

  const handleMethodChange = (index: number, field: keyof Method, value: string) => {
    if (!draft) return;
    const updated = [...draft.methods];
    updated[index] = { ...updated[index], [field]: value } as Method;
    update({ methods: updated });
  };

  const handleAddMethod = () => {
    if (!draft) return;
    update({ methods: [...draft.methods, { name: 'newMethod', returnType: 'void', parameters: [], visibility: 'public' }] });
  };

  const handleRemoveMethod = (index: number) => {
    if (!draft) return;
    update({ methods: draft.methods.filter((_, i) => i !== index) });
  };

  const moveAttribute = (index: number, delta: number) => { if (draft) update({ attributes: moveItem(draft.attributes, index, delta) }); };
  const moveMethod = (index: number, delta: number) => { if (draft) update({ methods: moveItem(draft.methods, index, delta) }); };

  const setParameters = (index: number, change: (parameters: Parameter[]) => Parameter[]) => {
    if (!draft) return;
    const updated = [...draft.methods];
    updated[index] = { ...updated[index], parameters: change(updated[index].parameters) };
    update({ methods: updated });
  };

  if (!element || !draft) {
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
        ref={nameRef}
        value={draft.name}
        onChange={(e) => update({ name: e.target.value })}
        aria-invalid={problem?.field === 'name' || undefined}
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
        value={draft.stereotype}
        onChange={(e) => update({ stereotype: e.target.value })}
        placeholder="e.g. «entity»"
        className="field-input"
      />

      {/* Visibility */}
      <label className="field-label">Visibility</label>
      <select
        value={draft.visibility}
        onChange={(e) => update({ visibility: e.target.value as FormDraft['visibility'] })}
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
            <span>{draft.attributes.length}</span>
          </div>
          {attributesExpanded && (
            <div>
              {draft.attributes.map((attr, i) => (
                <div key={i} className="property-row" role="group" aria-label={`Attribute ${i + 1}`}>
                  {element.type !== 'enum' && (
                    <select
                      value={attr.visibility}
                      onChange={(e) => handleAttributeChange(i, 'visibility', e.target.value)}
                      className="field-select member-visibility"
                      aria-label="Attribute visibility"
                    >
                      {VISIBILITIES.map((v) => <option key={v.value} value={v.value}>{v.mark}</option>)}
                    </select>
                  )}
                  <input
                    value={attr.name}
                    onChange={(e) => handleAttributeChange(i, 'name', e.target.value)}
                    className="field-input"
                    style={{ flex: 1 }}
                    placeholder="name"
                    aria-label="Attribute name"
                  />
                  {element.type !== 'enum' && (
                    <input
                      value={attr.type}
                      onChange={(e) => handleAttributeChange(i, 'type', e.target.value)}
                      className="field-input"
                      style={{ flex: 1 }}
                      placeholder="type"
                      aria-label="Attribute type"
                    />
                  )}
                  <button onClick={() => moveAttribute(i, -1)} disabled={i === 0} className="panel-button" aria-label="Move attribute up">↑</button>
                  <button onClick={() => moveAttribute(i, 1)} disabled={i === draft.attributes.length - 1} className="panel-button" aria-label="Move attribute down">↓</button>
                  <button onClick={() => handleRemoveAttribute(i)} className="panel-button danger" aria-label="Remove attribute">
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
            <span>{draft.methods.length}</span>
          </div>
          {methodsExpanded && (
            <div>
              {draft.methods.map((method, i) => (
                <div key={i} className="method-block" role="group" aria-label={`Method ${i + 1}`}>
                  <div className="property-row">
                    <select
                      value={method.visibility}
                      onChange={(e) => handleMethodChange(i, 'visibility', e.target.value)}
                      className="field-select member-visibility"
                      aria-label="Method visibility"
                    >
                      {VISIBILITIES.map((v) => <option key={v.value} value={v.value}>{v.mark}</option>)}
                    </select>
                    <input
                      value={method.name}
                      onChange={(e) => handleMethodChange(i, 'name', e.target.value)}
                      className="field-input"
                      style={{ flex: 1 }}
                      placeholder="name"
                      aria-label="Method name"
                    />
                    <input
                      value={method.returnType}
                      onChange={(e) => handleMethodChange(i, 'returnType', e.target.value)}
                      className="field-input"
                      style={{ width: 70 }}
                      placeholder="return"
                      aria-label="Return type"
                    />
                    <button onClick={() => moveMethod(i, -1)} disabled={i === 0} className="panel-button" aria-label="Move method up">↑</button>
                    <button onClick={() => moveMethod(i, 1)} disabled={i === draft.methods.length - 1} className="panel-button" aria-label="Move method down">↓</button>
                    <button onClick={() => handleRemoveMethod(i)} className="panel-button danger" aria-label="Remove method">
                      ×
                    </button>
                  </div>
                  {method.parameters.map((parameter, pi) => (
                    <div key={pi} className="property-row parameter-row" role="group" aria-label={`Parameter ${pi + 1}`}>
                      <input
                        value={parameter.name}
                        onChange={(e) => setParameters(i, (list) => list.map((p, k) => (k === pi ? { ...p, name: e.target.value } : p)))}
                        className="field-input"
                        style={{ flex: 1 }}
                        placeholder="parameter"
                        aria-label="Parameter name"
                      />
                      <input
                        value={parameter.type}
                        onChange={(e) => setParameters(i, (list) => list.map((p, k) => (k === pi ? { ...p, type: e.target.value } : p)))}
                        className="field-input"
                        style={{ flex: 1 }}
                        placeholder="type"
                        aria-label="Parameter type"
                      />
                      <button onClick={() => setParameters(i, (list) => moveItem(list, pi, -1))} disabled={pi === 0} className="panel-button" aria-label="Move parameter up">↑</button>
                      <button onClick={() => setParameters(i, (list) => moveItem(list, pi, 1))} disabled={pi === method.parameters.length - 1} className="panel-button" aria-label="Move parameter down">↓</button>
                      <button onClick={() => setParameters(i, (list) => list.filter((_, k) => k !== pi))} className="panel-button danger" aria-label="Remove parameter">×</button>
                    </div>
                  ))}
                  <button onClick={() => setParameters(i, (list) => [...list, { name: unusedName(list.map((p) => p.name), 'arg'), type: 'string' }])} className="panel-button">
                    + Add Parameter
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
      {element && owner && onParentChange && (owner.parentId !== null || owner.choices.length > 0) && (
        <>
          <label className="field-label" htmlFor="element-parent">Parent</label>
          <select
            id="element-parent"
            className="field-select"
            value={owner.parentId ?? ''}
            disabled={dirty}
            onChange={(e) => {
              const refusal = onParentChange(element.id, e.target.value === '' ? null : e.target.value) ?? null;
              setProblem(refusal ? { message: refusal } : null);
            }}
          >
            <option value="">(none, top level)</option>
            {owner.choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
          </select>
          {dirty && <div className="panel-note">Apply or cancel your changes to change the parent.</div>}
        </>
      )}
      <div className="form-actions">
        {problem && (
          <div className="form-error" role="alert" tabIndex={-1} ref={alertRef}>{problem.message}</div>
        )}
        <button className="panel-button" onClick={() => { apply(); }} disabled={!dirty}>Apply</button>
        <button className="panel-button" onClick={cancel} disabled={!dirty}>Cancel</button>
      </div>
      </fieldset>
    </div>
  );
};
