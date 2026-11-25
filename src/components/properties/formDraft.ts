import type { Attribute, ElementProperties, Method } from '../../types';

/** The fields the element form edits as one buffered draft (A05.01). */
export interface FormDraft {
  name: string;
  stereotype: string;
  visibility: NonNullable<ElementProperties['visibility']>;
  attributes: Attribute[];
  methods: Method[];
}

export function draftFrom(properties: ElementProperties): FormDraft {
  return {
    name: properties.name,
    stereotype: properties.stereotype ?? '',
    visibility: properties.visibility ?? 'public',
    attributes: structuredClone(properties.attributes ?? []),
    methods: structuredClone(properties.methods ?? []),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The properties that differ between the saved element and the draft, ready for
 * one `element-update`. A cleared stereotype is `undefined`; untouched fields
 * are left out, so applying a clean draft sends nothing.
 */
export function changesFrom(original: ElementProperties, draft: FormDraft): Partial<ElementProperties> {
  const base = draftFrom(original);
  const changes: Partial<ElementProperties> = {};
  if (draft.name !== base.name) changes.name = draft.name;
  const stereotype = draft.stereotype.trim();
  if (stereotype !== base.stereotype) changes.stereotype = stereotype === '' ? undefined : stereotype;
  if (draft.visibility !== base.visibility) changes.visibility = draft.visibility;
  if (!same(draft.attributes, base.attributes)) changes.attributes = draft.attributes;
  if (!same(draft.methods, base.methods)) changes.methods = draft.methods;
  return changes;
}

export const isDirty = (original: ElementProperties, draft: FormDraft): boolean =>
  Object.keys(changesFrom(original, draft)).length > 0;

/** A problem the form can see without asking the engine, or null. */
export function localProblem(draft: FormDraft): { field: 'name'; message: string } | null {
  return draft.name.trim() === '' ? { field: 'name', message: 'Name cannot be empty.' } : null;
}
