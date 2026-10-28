import React, { useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';

const theme = EditorView.theme({
  '&': { fontSize: '14px', height: '100%' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace", lineHeight: '1.55' },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': { background: '#0d1526', borderRight: '1px solid #1b2742' },
  '&.cm-editor': { background: '#0d1526' },
  '.cm-activeLine': { background: 'rgba(97,218,251,0.06)' },
  '.cm-activeLineGutter': { background: 'rgba(97,218,251,0.08)' },
});

export function Editor({ value, onChange, onSubmit, readOnly = false, height = '100%' }) {
  // The extensions are memoized, so the submit handler is read through a ref.
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const extensions = useMemo(
    () => [
      javascript({ jsx: true }),
      theme,
      EditorView.lineWrapping,
      // Ctrl/⌘ + Enter submits instead of the default keymap's insertBlankLine.
      Prec.highest(
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              if (!onSubmitRef.current) return false;
              onSubmitRef.current();
              return true;
            },
          },
        ]),
      ),
    ],
    [],
  );
  return (
    <CodeMirror
      value={value}
      height={height}
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
        tabSize: 2,
      }}
    />
  );
}
