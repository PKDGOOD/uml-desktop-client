// =============================================================================
// DSLEditor - Monaco Editor with DSL language support
// =============================================================================

import React, { useRef, useCallback, useState, useEffect } from 'react';
import Editor, { loader, type OnMount, type OnChange } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/editor/edcore.main.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import type { DSLError } from '../../types';

// Bundle the editor and its worker locally instead of fetching code from a CDN.
globalThis.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

/** DSL keywords used for syntax highlighting and auto-completion. */
const DSL_KEYWORDS = [
  '@class-diagram', '@sequence-diagram', '@usecase-diagram',
  '@activity-diagram', '@state-diagram',
  'class', 'interface', 'enum', 'abstract',
  'lifeline', 'actor', 'usecase', 'system-boundary',
  'action', 'decision', 'fork', 'join', 'initial-node', 'final-node',
  'state', 'composite-state', 'initial-state', 'final-state',
  'note', 'package',
];

const VISIBILITY_MARKERS = ['+', '-', '#', '~'];

const RELATIONSHIP_OPERATORS = [
  '-->', '--|>', '..>', '..|>', '--*', '--o', '--', '..', '-->>', '-.->',
];

export interface DSLEditorProps {
  /** Current DSL text value */
  value: string;
  /** Called when the user edits text */
  onChange: (value: string) => void;
  /** Parse errors to display as inline markers */
  errors?: DSLError[];
  /** Read-only mode */
  readOnly?: boolean;
}

export const DSLEditor: React.FC<DSLEditorProps> = ({
  value,
  onChange,
  errors = [],
  readOnly = false,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);

  // Register custom language on mount
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMounted(true);

    // Register 'uml-dsl' language if not already registered
    if (!monaco.languages.getLanguages().some((l: any) => l.id === 'uml-dsl')) {
      monaco.languages.register({ id: 'uml-dsl' });

      // Syntax highlighting (monarch tokenizer)
      monaco.languages.setMonarchTokensProvider('uml-dsl', {
        keywords: DSL_KEYWORDS,
        tokenizer: {
          root: [
            // Diagram type declarations
            [/@\w[\w-]*/, 'keyword'],
            // Visibility markers at start of line or after whitespace
            [/[+\-#~]\s/, 'keyword.operator'],
            // Relationship operators
            [/--\|>|\.\.>|\.\.\|>|--\*|--o|-->>|-\.->|-->|--|\.\./, 'operator'],
            // Strings
            [/"[^"]*"/, 'string'],
            // Comments
            [/\/\/.*$/, 'comment'],
            // Braces
            [/[{}()\[\]]/, 'delimiter.bracket'],
            // Multiplicity
            [/"[*\d.]+"\s/, 'number'],
            // Colon for type annotations
            [/:/, 'delimiter'],
            // Identifiers that match keywords
            [/[a-zA-Z_][\w-]*/, {
              cases: {
                '@keywords': 'keyword',
                '@default': 'identifier',
              },
            }],
            // Numbers
            [/\d+/, 'number'],
            // Whitespace
            [/\s+/, 'white'],
          ],
        },
      });

      // Auto-completion provider
      monaco.languages.registerCompletionItemProvider('uml-dsl', {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = DSL_KEYWORDS.map((kw) => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          }));

          // Add visibility markers
          for (const v of VISIBILITY_MARKERS) {
            suggestions.push({
              label: v,
              kind: monaco.languages.CompletionItemKind.Operator,
              insertText: v + ' ',
              range,
            });
          }

          // Add relationship operators
          for (const op of RELATIONSHIP_OPERATORS) {
            suggestions.push({
              label: op,
              kind: monaco.languages.CompletionItemKind.Operator,
              insertText: op + ' ',
              range,
            });
          }

          // Extract element names from current text for auto-complete
          const text = model.getValue();
          const nameMatches = text.match(/(?:class|interface|enum|actor|state|lifeline|usecase|action)\s+(\w+)/g);
          if (nameMatches) {
            const names = new Set<string>();
            for (const m of nameMatches) {
              const parts = m.split(/\s+/);
              if (parts[1]) names.add(parts[1]);
            }
            for (const name of names) {
              suggestions.push({
                label: name,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: name,
                range,
              });
            }
          }

          return { suggestions };
        },
      });
    }
  }, []);

  // Update error markers when errors change
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const model = editor.getModel();
    if (!model) return;

    const markers = errors.map((err) => ({
      severity: monaco.MarkerSeverity.Error,
      message: err.message,
      startLineNumber: err.line,
      startColumn: err.column,
      endLineNumber: err.line,
      endColumn: err.column + 1,
    }));

    monaco.editor.setModelMarkers(model, 'uml-dsl', markers);
  }, [errors, mounted]);

  const handleChange: OnChange = useCallback(
    (newValue) => {
      if (newValue == null) return;
      onChange(newValue);
    },
    [onChange],
  );

  return (
    <div className="dsl-editor">
      {errors.length > 0 && (
        <div className="dsl-error" role="status">
          <strong>Line {errors[0].line}: {errors[0].message}</strong>
          <span>Canvas shows the last valid version. Save keeps your draft.</span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
      <Editor
        language="uml-dsl"
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          ariaLabel: 'UML DSL editor',
          lineNumbers: 'on',
          minimap: { enabled: false },
          readOnly,
          automaticLayout: true,
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
        }}
      />
      </div>
    </div>
  );
};
