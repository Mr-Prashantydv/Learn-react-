export const RANKS = [
  { xp: 0, title: 'Wanderer', icon: '🌱' },
  { xp: 300, title: 'Apprentice', icon: '🔰' },
  { xp: 800, title: 'Component Smith', icon: '🔨' },
  { xp: 1500, title: 'State Shaper', icon: '🧪' },
  { xp: 2500, title: 'Effect Whisperer', icon: '🌀' },
  { xp: 3800, title: 'Hook Sage', icon: '🪝' },
  { xp: 5200, title: 'Pattern Knight', icon: '🛡️' },
  { xp: 7000, title: 'Render Mage', icon: '🔮' },
  { xp: 9000, title: 'Grandmaster of Reactoria', icon: '👑' },
];

export function rankFor(xp) {
  let current = RANKS[0];
  let next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].xp) current = RANKS[i];
    else {
      next = RANKS[i];
      break;
    }
  }
  const progress = next ? (xp - current.xp) / (next.xp - current.xp) : 1;
  return { ...current, level: RANKS.indexOf(current) + 1, next, progress };
}

export function computeStars({ hintsUsed = 0, solutionShown = false, attempts = 1 }) {
  if (solutionShown) return 1;
  if (hintsUsed > 0 || attempts > 3) return 2;
  return 3;
}

export function xpForStars(baseXp, stars) {
  const multiplier = stars >= 3 ? 1 : stars === 2 ? 0.7 : 0.4;
  return Math.round(baseXp * multiplier);
}

export function flattenLevels(chapters) {
  const out = [];
  chapters.forEach((chapter, ci) => {
    chapter.levels.forEach((level, li) => {
      out.push({ ...level, chapterId: chapter.id, chapterIndex: ci, levelIndex: li, chapter });
    });
  });
  return out;
}

/** 'locked' | 'available' | 'completed' */
export function levelStatus(state, allLevels, levelId) {
  if (state.completed[levelId]) return 'completed';
  if (state.settings.unlockAll) return 'available';
  const index = allLevels.findIndex((l) => l.id === levelId);
  if (index <= 0) return 'available';
  const prev = allLevels[index - 1];
  return state.completed[prev.id] ? 'available' : 'locked';
}

export function chapterStatus(state, allLevels, chapter) {
  const ids = chapter.levels.map((l) => l.id);
  const done = ids.filter((id) => state.completed[id]).length;
  if (done === ids.length) return 'completed';
  const first = levelStatus(state, allLevels, ids[0]);
  if (first === 'locked') return 'locked';
  return 'active';
}

export function nextLevelId(state, allLevels) {
  const next = allLevels.find((l) => levelStatus(state, allLevels, l.id) === 'available');
  return next ? next.id : null;
}

export function totalStars(state) {
  return Object.values(state.completed).reduce((sum, c) => sum + (c.stars || 0), 0);
}
