import React, { useEffect } from 'react';
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

export function Modal({ children, onClose, className = '', wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${className}`} role="dialog" aria-modal="true">
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
