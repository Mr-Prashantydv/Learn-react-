/**
 * Timer implementations injected into the sandbox.
 *
 * The player's code never touches the real `setTimeout`/`setInterval` —
 * it receives one of these. That lets quests (a) run deterministically with
 * fake time, and (b) detect intervals that were never cleaned up.
 */

export function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  let queue = [];

  function schedule(fn, delay, args, interval) {
    const id = nextId++;
    const ms = Math.max(0, Number(delay) || 0);
    queue.push({ id, fn, args, at: now + ms, interval: interval ? ms : null });
    queue.sort((a, b) => a.at - b.at || a.id - b.id);
    return id;
  }

  const timers = {
    kind: 'fake',
    setTimeout: (fn, delay, ...args) => schedule(fn, delay, args, false),
    setInterval: (fn, delay, ...args) => schedule(fn, delay, args, true),
    clearTimeout: (id) => {
      queue = queue.filter((t) => t.id !== id);
    },
    clearInterval: (id) => {
      queue = queue.filter((t) => t.id !== id);
    },
    now: () => now,
    /** Advance fake time, running every timer that becomes due (in order). */
    advance(ms) {
      const target = now + Math.max(0, ms);
      let safety = 10000;
      while (queue.length && queue[0].at <= target && safety-- > 0) {
        const t = queue.shift();
        now = t.at;
        if (t.interval !== null) {
          queue.push({ ...t, at: t.at + Math.max(1, t.interval) });
          queue.sort((a, b) => a.at - b.at || a.id - b.id);
        }
        t.fn(...t.args);
      }
      now = target;
    },
    pendingTimeouts: () => queue.filter((t) => t.interval === null).length,
    pendingIntervals: () => queue.filter((t) => t.interval !== null).length,
    reset() {
      queue = [];
      now = 0;
    },
  };
  // Fake timers only advance through ctx.tick, so they are never tracked in
  // liveRealTimers: waiting real time can never drain them.
  return timers;
}

/**
 * Real timers, but tracked so the preview can be torn down cleanly.
 *
 * `reset()` clears intervals immediately but lets pending timeouts fire:
 * an async Action awaiting a timer must be allowed to finish, otherwise React
 * (which tracks pending Actions globally) would keep every later Action on
 * the page pending forever. Timeouts scheduled after a reset are still
 * honoured for a short grace period, so promise chains can complete, but a
 * runaway setTimeout loop dies out.
 */
const liveRealTimers = new Set();

/**
 * Resolves once no preview sandbox has a pending timeout (or after `maxMs`).
 * React entangles every in-flight async Action on the page, so a quest check
 * started while a preview Action is still awaiting a timer would stall.
 */
export function waitForRealTimers(maxMs = 2500) {
  const start = Date.now();
  return new Promise((resolve) => {
    const poll = () => {
      let pending = 0;
      for (const t of liveRealTimers) pending += t.pendingTimeouts();
      if (pending === 0 || Date.now() - start >= maxMs) resolve();
      else setTimeout(poll, 50);
    };
    poll();
  });
}

export function createRealTimers() {
  const active = new Map();
  let disposedAt = null;
  const GRACE_MS = 5000;
  const allowed = () => disposedAt === null || Date.now() - disposedAt < GRACE_MS;
  const timers = {
    kind: 'real',
    setTimeout: (fn, delay, ...args) => {
      if (!allowed()) return 0;
      const id = setTimeout(() => {
        active.delete(id);
        fn(...args);
      }, delay);
      active.set(id, 'timeout');
      return id;
    },
    setInterval: (fn, delay, ...args) => {
      if (disposedAt !== null) return 0;
      const id = setInterval(() => fn(...args), delay);
      active.set(id, 'interval');
      return id;
    },
    clearTimeout: (id) => {
      clearTimeout(id);
      active.delete(id);
    },
    clearInterval: (id) => {
      clearInterval(id);
      active.delete(id);
    },
    now: () => Date.now(),
    advance: () => {},
    pendingTimeouts: () => [...active.values()].filter((k) => k === 'timeout').length,
    pendingIntervals: () => [...active.values()].filter((k) => k === 'interval').length,
    /** Called when the preview is torn down. */
    reset() {
      setTimeout(() => liveRealTimers.delete(timers), GRACE_MS);
      disposedAt = Date.now();
      for (const [id, kind] of active) {
        if (kind === 'interval') {
          clearInterval(id);
          active.delete(id);
        }
      }
    },
  };
  liveRealTimers.add(timers);
  return timers;
}
