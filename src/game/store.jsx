import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { computeStars, xpForStars } from './progression.js';
import { allLevels } from '../content/index.js';

const SAVE_KEY = 'reactoria:save:v1';

export function prefersReducedMotion() {
  try {
    return Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

export const initialState = {
  version: 1,
  player: { name: '', avatar: '🧙', createdAt: null },
  xp: 0,
  completed: {}, // levelId -> { stars, xp, completedAt, attempts, hintsUsed }
  levelState: {}, // levelId -> { attempts, hintsUsed, solutionShown }
  drafts: {}, // levelId -> source code
  badges: [],
  codex: [],
  settings: { sound: true, motion: !prefersReducedMotion(), unlockAll: false },
  introSeen: false,
  chapterIntrosSeen: [],
  stats: { checks: 0, hints: 0, firstTry: 0, sessions: 0 },
  streak: { days: 0, last: null },
  finishedAt: null,
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function bumpStreak(streak) {
  const today = todayKey();
  if (streak.last === today) return streak;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
  const days = streak.last === yKey ? streak.days + 1 : 1;
  return { days, last: today };
}

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_PLAYER':
      return {
        ...state,
        player: { ...state.player, ...action.player, createdAt: state.player.createdAt || Date.now() },
      };
    case 'MARK_INTRO':
      return { ...state, introSeen: true };
    case 'MARK_CHAPTER_INTRO':
      if (state.chapterIntrosSeen.includes(action.chapterId)) return state;
      return { ...state, chapterIntrosSeen: [...state.chapterIntrosSeen, action.chapterId] };
    case 'SAVE_DRAFT':
      if (state.drafts[action.levelId] === action.source) return state;
      return { ...state, drafts: { ...state.drafts, [action.levelId]: action.source } };
    case 'RESET_DRAFT': {
      const drafts = { ...state.drafts };
      delete drafts[action.levelId];
      return { ...state, drafts };
    }
    case 'USE_HINT': {
      const ls = state.levelState[action.levelId] || { attempts: 0, hintsUsed: 0, solutionShown: false };
      if (ls.hintsUsed >= action.index + 1) return state;
      return {
        ...state,
        levelState: { ...state.levelState, [action.levelId]: { ...ls, hintsUsed: action.index + 1 } },
        stats: { ...state.stats, hints: state.stats.hints + 1 },
      };
    }
    case 'SHOW_SOLUTION': {
      const ls = state.levelState[action.levelId] || { attempts: 0, hintsUsed: 0, solutionShown: false };
      return { ...state, levelState: { ...state.levelState, [action.levelId]: { ...ls, solutionShown: true } } };
    }
    case 'RECORD_ATTEMPT': {
      const ls = state.levelState[action.levelId] || { attempts: 0, hintsUsed: 0, solutionShown: false };
      return {
        ...state,
        levelState: { ...state.levelState, [action.levelId]: { ...ls, attempts: ls.attempts + 1 } },
        stats: { ...state.stats, checks: state.stats.checks + 1 },
        streak: bumpStreak(state.streak),
      };
    }
    case 'COMPLETE_LEVEL': {
      const { level } = action;
      const ls = state.levelState[level.id] || { attempts: 1, hintsUsed: 0, solutionShown: false };
      const stars = level.type === 'quiz' ? action.stars ?? 3 : computeStars(ls);
      const existing = state.completed[level.id];
      const earnedXp = xpForStars(level.xp || 100, stars);
      const prevXp = existing?.xp || 0;
      const bestStars = Math.max(stars, existing?.stars || 0);
      const xpDelta = Math.max(0, earnedXp - prevXp);
      const badges =
        level.badge && !state.badges.includes(level.badge.id) ? [...state.badges, level.badge.id] : state.badges;
      const concepts = (level.concepts || []).map((c) => c.id).filter((id) => !state.codex.includes(id));
      const completed = {
        ...state.completed,
        [level.id]: {
          stars: bestStars,
          xp: Math.max(prevXp, earnedXp),
          completedAt: existing?.completedAt || Date.now(),
          attempts: ls.attempts,
          hintsUsed: ls.hintsUsed,
        },
      };
      // The certificate is for restoring every region, so it only unlocks once
      // every level is complete (Explorer mode lets players reach the end early).
      const allDone = allLevels.length > 0 && allLevels.every((l) => completed[l.id]);
      return {
        ...state,
        xp: state.xp + xpDelta,
        completed,
        // The run is over: the next replay starts with a clean slate, while
        // `completed` keeps the best stars and XP.
        levelState: { ...state.levelState, [level.id]: { attempts: 0, hintsUsed: 0, solutionShown: false } },
        badges,
        codex: concepts.length ? [...state.codex, ...concepts] : state.codex,
        stats: {
          ...state.stats,
          firstTry: state.stats.firstTry + (!existing && ls.attempts <= 1 && ls.hintsUsed === 0 ? 1 : 0),
        },
        streak: bumpStreak(state.streak),
        finishedAt: allDone && !state.finishedAt ? Date.now() : state.finishedAt,
        lastReward: {
          levelId: level.id,
          stars,
          xp: xpDelta,
          xpBefore: state.xp,
          xpAfter: state.xp + xpDelta,
          solutionShown: Boolean(ls.solutionShown),
          // Only what is new for the player.
          badge: level.badge && !state.badges.includes(level.badge.id) ? level.badge : null,
          concepts: (level.concepts || []).filter((c) => !state.codex.includes(c.id)),
        },
      };
    }
    case 'SET_SETTING':
      return { ...state, settings: { ...state.settings, [action.key]: action.value } };
    case 'IMPORT':
      return sanitizeSave(action.state) || state;
    case 'RESET':
      return { ...initialState, settings: state.settings };
    default:
      return state;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return initialState;
    return sanitizeSave(JSON.parse(raw)) || initialState;
  } catch {
    return initialState;
  }
}

const isObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** Merges `value` over `fallback`, keeping only keys whose type matches the fallback's. */
function sameShape(value, fallback) {
  const out = { ...fallback };
  if (!isObject(value)) return out;
  for (const key of Object.keys(value)) {
    const v = value[key];
    const f = fallback[key];
    if (!(key in fallback) || f === null) out[key] = v;
    else if (typeof f === 'number' ? isNumber(v) : typeof v === typeof f && Array.isArray(v) === Array.isArray(f)) out[key] = v;
  }
  return out;
}

/**
 * Coerces a stored or imported save into the shape the game expects, so a
 * malformed file can never leave the app crashing on every load.
 * Returns null when it is not a Reactoria save at all.
 */
export function sanitizeSave(raw) {
  if (!isObject(raw) || !isObject(raw.player)) return null;
  if (raw.version !== undefined && raw.version !== initialState.version) return null;
  const record = (v, valid) =>
    isObject(v) ? Object.fromEntries(Object.entries(v).filter(([, entry]) => valid(entry))) : {};
  const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  return {
    ...initialState,
    version: initialState.version,
    player: sameShape(raw.player, initialState.player),
    xp: isNumber(raw.xp) && raw.xp >= 0 ? raw.xp : 0,
    completed: record(raw.completed, (c) => isObject(c) && isNumber(c.stars)),
    levelState: Object.fromEntries(
      Object.entries(record(raw.levelState, isObject)).map(([id, ls]) => [
        id,
        sameShape(ls, { attempts: 0, hintsUsed: 0, solutionShown: false }),
      ]),
    ),
    drafts: record(raw.drafts, (d) => typeof d === 'string'),
    badges: strings(raw.badges),
    codex: strings(raw.codex),
    settings: sameShape(raw.settings, initialState.settings),
    introSeen: Boolean(raw.introSeen),
    chapterIntrosSeen: strings(raw.chapterIntrosSeen),
    stats: sameShape(raw.stats, initialState.stats),
    streak: sameShape(raw.streak, initialState.streak),
    finishedAt: isNumber(raw.finishedAt) ? raw.finishedAt : null,
  };
}

/** Removes the stored save (used by the crash screen's "reset save"). */
export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function persist(state) {
  try {
    const { lastReward, ...rest } = state;
    localStorage.setItem(SAVE_KEY, JSON.stringify(rest));
  } catch {
    /* storage might be unavailable (private mode) — the game still works */
  }
}

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadSave);
  useEffect(() => {
    persist(state);
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside <GameProvider>');
  return ctx;
}
