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
  return timers;
}

/** Real timers, but tracked so that we can clean them up and count leaks. */
export function createRealTimers() {
  const active = new Map();
  const timers = {
    kind: 'real',
    setTimeout: (fn, delay, ...args) => {
      const id = setTimeout(() => {
        active.delete(id);
        fn(...args);
      }, delay);
      active.set(id, 'timeout');
      return id;
    },
    setInterval: (fn, delay, ...args) => {
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
    /** Clears everything the sandbox created (called when the preview is torn down). */
    reset() {
      for (const [id, kind] of active) {
        if (kind === 'interval') clearInterval(id);
        else clearTimeout(id);
      }
      active.clear();
    },
  };
  return timers;
}
