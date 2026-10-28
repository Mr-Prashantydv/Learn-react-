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

const BULLET = /^\s*[-*]\s+/;
const ORDERED = /^\s*\d+[.)]\s+/;
const indentOf = (line) => line.match(/^[ \t]*/)[0].length;
const startsBlock = (line) =>
  line.startsWith('```') || line.startsWith(':::') || /^(#{1,4})\s/.test(line) || line.startsWith('>') || line.startsWith('|');

/**
 * Parses a (possibly nested) list starting at `start`. Supports items that
 * wrap onto indented continuation lines (or "lazy" unindented ones), nested
 * lists, code blocks inside items, blank lines between items, and ordered
 * lists that start at a number other than 1.
 */
function parseList(lines, start) {
  const ordered = ORDERED.test(lines[start]);
  const marker = ordered ? ORDERED : BULLET;
  const base = indentOf(lines[start]);
  const first = ordered ? parseInt(lines[start].trim(), 10) : 1;
  const items = [];
  let i = start;
  let current = null;
  let col = 2; // content column of the current item, relative to `base`
  let inFence = false;
  const strip = (line) => line.slice(Math.min(indentOf(line), base + col));

  while (i < lines.length) {
    const line = lines[i];
    if (inFence) {
      current.push(strip(line));
      if (line.trim().startsWith('```')) inFence = false;
      i++;
      continue;
    }
    if (!line.trim()) {
      // A blank line ends the list unless more of it follows.
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && ((indentOf(lines[j]) === base && marker.test(lines[j])) || indentOf(lines[j]) > base)) {
        if (current) current.push('');
        i = j;
        continue;
      }
      break;
    }
    const indent = indentOf(line);
    if (indent === base && marker.test(line)) {
      const m = line.match(marker)[0];
      col = m.length - base;
      current = [line.slice(m.length)];
      items.push(current);
      i++;
      continue;
    }
    if (indent > base && current) {
      // Continuation or nested content, relative to the item's content column.
      current.push(strip(line));
      if (line.trim().startsWith('```')) inFence = true;
      i++;
      continue;
    }
    if (indent <= base && current && !BULLET.test(line) && !ORDERED.test(line) && !startsBlock(line.trim())) {
      // Lazy continuation of the item's paragraph.
      current.push(line.trim());
      i++;
      continue;
    }
    break;
  }

  const parsed = items.map((itemLines) => {
    const [head, ...rest] = itemLines;
    const blocks = parseBlocks([head, ...rest].join('\n'));
    return blocks;
  });
  return { block: { type: 'list', ordered, start: first, items: parsed }, next: i };
}

export function parseBlocks(text) {
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
    if (BULLET.test(line) || ORDERED.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
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
      !BULLET.test(lines[i]) &&
      !ORDERED.test(lines[i]) &&
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
        <Tag key={key} start={block.ordered && block.start !== 1 ? block.start : undefined}>
          {block.items.map((itemBlocks, i) => (
            <li key={i}>
              {itemBlocks.length === 1 && itemBlocks[0].type === 'p'
                ? renderInline(itemBlocks[0].text)
                : itemBlocks.map((b, j) => (j === 0 && b.type === 'p' ? <span key={j}>{renderInline(b.text)}</span> : renderBlock(b, j)))}
            </li>
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
