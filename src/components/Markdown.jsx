import React from 'react';
import { CodeBlock } from './CodeBlock.jsx';

/**
 * A deliberately small markdown renderer for lesson text.
 * Supports: headings (#, ##, ###), paragraphs, **bold**, *italic*, `code`,
 * fenced ```code``` blocks, bullet / numbered lists, > quotes and
 * callouts written as `:::tip`, `:::warn`, `:::story` ... `:::`.
 */
export function Markdown({ text }) {
  const blocks = parseBlocks(text || '');
  return <div className="md">{blocks.map((b, i) => renderBlock(b, i))}</div>;
}

function parseBlocks(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const title = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', code: buf.join('\n'), title: title && !/^(jsx?|tsx?|js|html|css|bash|sh)$/i.test(title) ? title : '' });
      continue;
    }
    if (line.startsWith(':::')) {
      const kind = line.slice(3).trim() || 'tip';
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith(':::')) buf.push(lines[i++]);
      i++;
      blocks.push({ type: 'callout', kind, children: parseBlocks(buf.join('\n')) });
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }
    if (line.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: buf.join(' ') });
      continue;
    }
    if (line.trim() === '---') {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const cells = rows
        .filter((r) => !/^\|\s*-+/.test(r))
        .map((r) => r.split('|').slice(1, -1).map((c) => c.trim()));
      blocks.push({ type: 'table', head: cells[0], rows: cells.slice(1) });
      continue;
    }
    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith('```') &&
      !lines[i].startsWith(':::') &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('|')
    )
      buf.push(lines[i++]);
    blocks.push({ type: 'p', text: buf.join(' ') });
  }
  return blocks;
}

function renderBlock(block, key) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(4, block.level + 1)}`;
      return <Tag key={key}>{renderInline(block.text)}</Tag>;
    }
    case 'p':
      return <p key={key}>{renderInline(block.text)}</p>;
    case 'code':
      return <CodeBlock key={key} code={block.code} title={block.title} />;
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag key={key}>
          {block.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
    }
    case 'quote':
      return <blockquote key={key}>{renderInline(block.text)}</blockquote>;
    case 'hr':
      return <hr key={key} />;
    case 'table':
      return (
        <table key={key} className="md-table">
          <thead>
            <tr>
              {block.head.map((h, i) => (
                <th key={i}>{renderInline(h)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{renderInline(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'callout': {
      const icons = { tip: '💡', warn: '⚠️', story: '📜', mistake: '🪤', pro: '🏆', pip: '✨', try: '🎮' };
      const titles = { tip: 'Tip', warn: 'Watch out', story: 'Lore', mistake: 'Common mistake', pro: 'Pro move', pip: 'Pip says', try: 'Try it' };
      return (
        <div key={key} className={`callout callout-${block.kind}`}>
          <div className="callout-title">
            <span>{icons[block.kind] || '💡'}</span> {titles[block.kind] || block.kind}
          </div>
          {block.children.map((b, i) => renderBlock(b, i))}
        </div>
      );
    }
    default:
      return null;
  }
}

/** Inline: **bold**, *italic*, `code`, [text](url) */
export function renderInline(text) {
  const out = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const s = m[0];
    if (s.startsWith('`')) out.push(<code key={k++} className="code-inline">{s.slice(1, -1)}</code>);
    else if (s.startsWith('**')) out.push(<strong key={k++}>{s.slice(2, -2)}</strong>);
    else if (s.startsWith('[')) {
      const mm = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      out.push(
        <a key={k++} href={mm[2]} target="_blank" rel="noreferrer">
          {mm[1]}
        </a>,
      );
    } else out.push(<em key={k++}>{s.slice(1, -1)}</em>);
    last = m.index + s.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
