# ADR 0002: Stable DSL identity and source-edit mapping

- Status: **Accepted** (A02.02; maintainer accepted 2026-10-27)
- Date: 2026-10-27
- Backlog: [A02.02](../atomic-execution-plan.md) · Contracts: [P-04, P-05, AC-02, AC-03](../product-spec.md)
- Depends on: [ADR 0001](0001-project-file-envelope.md); reproductions F1 (A01.05) and F2 (A01.06) in the [baseline report](../reviews/2026-09-27-execution-baseline.md)
- Implemented by: A03.03/A03.06 (validation), A04.01 (spans), A04.02–A04.08 (targeted edits and fixes)

## Context

The DSL text contains no IDs. `src/parser/dsl/uml.pegjs` gives every element and connector a random ID on each parse. `preserveIds` in `src/engine/syncEngine.ts` then copies old IDs onto the new parse:

- Elements are matched on `type:name`. The parser's `nameToId` map silently lets a later duplicate name win, so connectors attach to whichever duplicate came last.
- An unresolved connector endpoint keeps the **name** as its `sourceId`/`targetId`. The model then holds a reference to nothing, and the connector is hidden (F4b in memory).
- Connectors are matched on `type`, both endpoints, and then on `label` when possible.
- Every canvas edit re-serializes the whole diagram. That discards comments and formatting, and loses nesting that the flat model cannot express (F2).
- Properties the DSL cannot express (element stereotype/visibility, connector waypoints and line style) survive a text edit only if the element's identity is found again. F1 shows they are lost even after a whitespace-only edit.

P-04/P-05 require that rename keeps identity and that canvas edits change only the affected text. They also require that ambiguous input gets a diagnostic, never a guess. This ADR fixes the rules. It adds **no** new syntax.

## Decision

### 1. No IDs in DSL text

The text stays free of IDs. Model IDs live only in the project file (ADR 0001 `diagrams[id].model`). An `@id(...)` annotation was considered and rejected (see Alternatives). Plain DSL that is copied or pasted is a semantic excerpt (P-06), so it carries no identity.

### 2. Element identity

- **Within a diagram, the DSL name is the element's key.** Names are unique across all named elements of a diagram, whatever their type, because connectors refer to endpoints by name alone.
- `Order` and `"Order"` are the same name (§4). Names are compared exactly: case-sensitive, with no Unicode normalization. `Order` and `order` are different names.
- When text parses successfully, each parsed element keeps the ID of the element in the **last valid model** with the same name. That is true even if the type changed (a `class Order` edited to `interface Order` keeps its ID). An element whose name was not there before gets a new ID. A name that is no longer there means the element was deleted.
- The match also carries over properties the DSL cannot express (for example stereotype and visibility). So any text edit that keeps the name keeps those properties. That is the basis of the F1 fix (A04.04).

### 3. Rename

| Where | Behavior | Identity |
| --- | --- | --- |
| Inspector or canvas (P-04) | One command changes the model name and rewrites the name token in its declaration and in every connector line that refers to it (§5). Undoing it restores the old text exactly. | **kept** |
| Text editor | Editing a name in text means delete the old element and create a new one. Connector lines still using the old name become unresolved-reference diagnostics until the user updates them. | **new ID**; layout survives through `@pos`/`@size`; model-only properties of the old element are dropped |

Matching renames in text by heuristics (position, the same members) was rejected as guessing. The diagnostic for a removed name that connectors still use suggests "Use Rename in the inspector to keep connections and settings."

Example: an inspector rename `Order` → `"구매 주문"`:

```text
before                                     after
class Order @pos(40, 40) {                 class "구매 주문" @pos(40, 40) {
  - id: String                               - id: String
}                                          }
// keep this comment                       // keep this comment
Customer "1" --> "*" Order : places        Customer "1" --> "*" "구매 주문" : places
```

The same rename typed in the text editor gives "Unknown element `Order` in line 5" until line 5 is updated. Then `구매 주문` is a new element with the same position.

### 4. Names, quoting and escaping

- A name that matches the grammar's `Identifier` (`[a-zA-Z_À-ɏ가-힯][a-zA-Z0-9_À-ɏ가-힯]*`) is written bare. Every other name is written as a JSON string literal, which is the serializer's current `formatName`. Names in other scripts (for example `注文`), and names with spaces or punctuation, are therefore quoted.
- When reading, `"..."` is decoded with JSON rules (`\"`, `\\`, `\uXXXX`).
- Element and diagram names must be non-empty after trimming and must not contain control characters U+0000–U+001F. A name such as `"a\nb"` is a semantic diagnostic, not a valid element. The inspector rejects these names before committing (A03.03).
- Member, parameter and enum-value names use `Identifier` only and **cannot** be quoted. The inspector rejects anything else (F3 → A03.07). This ADR does not widen the member grammar.
- Connector and message labels run to the end of the line and are trimmed. A label cannot contain a newline, and leading/trailing spaces are not kept. The inspector trims labels the same way, so the text and the model agree.
- Multiplicities are written in quotes. A multiplicity containing `"` or `\` is invalid (A03.03), so the serializer never needs to escape inside it.

| Model name | Written as |
| --- | --- |
| `Order` | `Order` |
| `주문` | `주문` |
| `Order Item` | `"Order Item"` |
| `say "hi"` | `"say \"hi\""` |
| `注文` | `"注文"` |

### 5. Source spans

When parsing succeeds, the parser (A04.01) records UTF-16 offset ranges, half-open `[start, end)`, which match editor offsets:

| Node | Span covers |
| --- | --- |
| Element declaration | from the keyword to the end of its annotations, or to the closing `}` for block declarations, not including the newline |
| Element name token | the bare or quoted name, including the quotes |
| Member/enum line | from the visibility marker to the end of the type, not including the newline |
| Connector/message line | the full line content, not including the newline |
| Connector endpoint tokens | each endpoint name token |
| `@pos` / `@size` annotation | the annotation, or an insertion point after the name token when it is absent |

Anything outside a span, such as comments, blank lines and spacing, is never rewritten. A canvas or inspector edit replaces only the spans it affects:

| Edit | Text change |
| --- | --- |
| Move or resize | Replace that element's `@pos`/`@size` span, or insert one |
| Rename (§3) | Replace the declaration name token and every endpoint token that matched the old name |
| Add or remove a member | Insert or remove one member line, reusing the indentation of the previous member line or else two spaces |
| Add an element | Append its declaration after the last declaration at the same nesting level (inside the parent block for a nested child) |
| Delete an element | Remove its declaration span and its line ending, plus every connector line that refers to it, all in one undo step |
| Add or delete a connector | Append it after the last connector line, or remove its line |

Example (illustrative): moving `Order` changes one annotation and nothing else:

```text
before:  class Order @pos(40, 40) @size(260, 180) {   // aggregate root
after:   class Order @pos(120, 40) @size(260, 180) {  // aggregate root
```

Whole-diagram regeneration remains only for a diagram that has no text yet (a new diagram or a migrated legacy file; ADR 0001 §7). Keeping a nested child inside its parent block, instead of flattening it, is what fixes F2 (A04.07).

### 6. Connector identity

After element IDs are matched, connectors are matched against the last valid model in two passes:

1. Exact key `(type, sourceId, targetId, label)`, by order of appearance. The *n*th connector with a key matches the *n*th old one with the same key.
2. For connectors left over, key `(type, sourceId, targetId)` is used, but **only if exactly one old and one new connector remain** for that key. A single label edit therefore keeps the ID. Two or more leftovers get new IDs; the pairing is never guessed.

A matched connector keeps its ID, waypoints and model-only properties. Text order sets sequence message order; A02.03 adds the explicit order field.

### 7. Ambiguity and invalid input

| Input | Result |
| --- | --- |
| Two elements named `Order` in one diagram, any types | Semantic diagnostic on the second declaration. Text becomes an `invalid` draft (ADR 0001 §5). The canvas shows the last valid diagram. |
| Connector refers to an undeclared name | Semantic diagnostic on the endpoint token; `invalid` draft. A name is never stored as an endpoint ID. |
| Pasted block repeats an existing name | Same as the duplicate-name row. No merge, rename or skip is offered automatically (P-05). |
| Canvas/inspector edit while the text is invalid | Rejected. `onCanvasChange` already refuses and keeps the draft; the visible reason ("Fix text errors before editing the diagram") is added with the P-05 canvas banner. |
| Canvas/inspector edit whose spans cannot be found, or whose result would not re-parse to the intended model | Rejected with a reason. The text and model are left unchanged. The whole text is never regenerated as a fallback. |
| Inspector rename to a name that is already used | Rejected before commit (P-04). |

After every targeted edit, the result is parsed again. It must give the intended model, using §2/§6 matching and ignoring ID generation. Otherwise the edit is rejected as in the second-to-last row. This check is the safety net for span bugs.

## Consequences

- Fixing F1 and F2, and the span and edit work in A04, can proceed without a grammar change.
- Text renames lose model-only settings. Users are pointed to the inspector rename. If that proves painful in the pilot, a later ADR can add opt-in syntax.
- Two diagrams can each have an `Order`. The uniqueness rule is per diagram; IDs are separate per diagram (ADR 0001 §4).
- Diagrams with duplicate names that open today will show diagnostics after A03.06. Their stored model still opens as the last valid model, and their text is marked `invalid`.

## Alternatives considered

- **`@id(...)` annotations in the text.** Rejected: they clutter text that people write and paste. A pasted excerpt would also bring foreign IDs, which then need collision rules. The name is already the unique reference connectors use.
- **Detecting text renames by position or matching members.** Rejected: that is guessing, which P-05 forbids, and wrong guesses silently move settings to another element.
- **Keeping the `type:name` key with duplicates allowed across types.** Rejected: connectors do not say a type, so `Order` would still be ambiguous.
- **Regenerating the whole text after canvas edits.** Rejected: it is the current behavior and the cause of comment loss and F2.
