import React, { useMemo } from 'react';
import { tokenize } from '../engine/highlight.js';

export function CodeBlock({ code, inline = false, title }) {
  const tokens = useMemo(() => tokenize(code.replace(/\n$/, '')), [code]);
  const body = tokens.map((t, i) => (
    <span key={i} className={`tok tok-${t.type}`}>
      {t.value}
    </span>
  ));
  if (inline) return <code className="code-inline">{body}</code>;
  return (
    <div className="codeblock">
      {title && <div className="codeblock-title">{title}</div>}
      <pre>
        <code>{body}</code>
      </pre>
    </div>
  );
}
