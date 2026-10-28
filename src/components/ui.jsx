import React, { useEffect, useRef } from 'react';
import { play } from '../game/sound.js';

export function Button({ children, variant = 'default', size, sound = 'click', className = '', onClick, ...rest }) {
  return (
    <button
      className={`btn ${variant !== 'default' ? `btn-${variant}` : ''} ${size ? `btn-${size}` : ''} ${className}`}
      onClick={(e) => {
        if (sound) play(sound);
        onClick?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ children, onClose, className = '', wide = false, labelledBy }) {
  const ref = useRef(null);

  // Move focus into the dialog (so Enter can't re-trigger the button behind
  // it) and give it back when the dialog closes.
  useEffect(() => {
    const previous = document.activeElement;
    const node = ref.current;
    const target = node?.querySelector('[data-autofocus]:not([disabled])') || node?.querySelector(FOCUSABLE) || node;
    target?.focus({ preventScroll: true });
    return () => {
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) {
        e.preventDefault();
        ref.current.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const inside = ref.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        className={`modal ${wide ? 'modal-wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

export function Stars({ count = 0, max = 3, size = 'md', animate = false }) {
  return (
    <span className={`stars stars-${size}`} aria-label={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`star ${i < count ? 'star-on' : ''} ${animate && i < count ? 'star-pop' : ''}`}
          style={animate ? { animationDelay: `${0.25 + i * 0.3}s` } : undefined}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function XpBar({ rank, xp }) {
  const pct = Math.round(rank.progress * 100);
  return (
    <div className="xpbar" title={rank.next ? `${xp} / ${rank.next.xp} XP to ${rank.next.title}` : 'Max rank!'}>
      <div className="xpbar-label">
        <span>
          {rank.icon} Lv.{rank.level} {rank.title}
        </span>
        <span className="xpbar-xp">{xp} XP</span>
      </div>
      <div className="xpbar-track">
        <div className="xpbar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function BadgeChip({ badge, locked = false }) {
  return (
    <div className={`badge-chip ${locked ? 'badge-locked' : ''}`} title={badge.description || badge.name}>
      <span className="badge-icon">{locked ? '🔒' : badge.icon}</span>
      <span className="badge-name">{badge.name}</span>
    </div>
  );
}

export function Tag({ children, color }) {
  return (
    <span className="tag" style={color ? { background: color } : undefined}>
      {children}
    </span>
  );
}
