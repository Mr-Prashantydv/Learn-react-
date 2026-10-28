/** Full-screen confetti burst drawn on a temporary canvas. */
export function burstConfetti({ count = 160, duration = 2600, colors } = {}) {
  if (typeof document === 'undefined') return;
  const palette = colors || ['#61dafb', '#ffd166', '#ef476f', '#06d6a0', '#a78bfa', '#ffffff'];
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  };
  resize();
  const W = () => canvas.width;
  const H = () => canvas.height;
  const particles = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 10;
    return {
      x: W() / 2 + (Math.random() - 0.5) * W() * 0.3,
      y: H() * 0.45,
      vx: Math.cos(angle) * speed * dpr,
      vy: Math.sin(angle) * speed * dpr - 8 * dpr,
      size: (6 + Math.random() * 8) * dpr,
      color: palette[Math.floor(Math.random() * palette.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    };
  });
  const start = performance.now();
  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, W(), H());
    for (const p of particles) {
      p.vy += 0.35 * dpr;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - t / duration);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  }
  requestAnimationFrame(frame);
}
