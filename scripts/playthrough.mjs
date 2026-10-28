/**
 * Plays EVERY level through the real UI in a headless browser:
 * pastes the reference solution, clicks "Check quest", expects the victory
 * modal; answers quizzes with the right options. Prints a report.
 * Usage: node scripts/playthrough.mjs [chapter-id-filter]
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('This script needs Playwright: `npm i -D playwright && npx playwright install chromium`, then start `npm run preview` in another terminal.');
  process.exit(1);
}
const { chapters } = await import('../src/content/index.js');
const filter = process.argv[2];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
await page.goto('http://localhost:4173/');
await page.evaluate(() =>
  localStorage.setItem(
    'reactoria:save:v1',
    JSON.stringify({ player: { name: 'Tester', avatar: '🤖' }, introSeen: true, chapterIntrosSeen: [], settings: { sound: false, motion: false, unlockAll: true } }),
  ),
);
let failures = 0;
let played = 0;
for (const chapter of chapters) {
  if (filter && !chapter.id.includes(filter)) continue;
  console.log(`\n${chapter.icon} ${chapter.title}`);
  for (const level of chapter.levels) {
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
    // dismiss any map dialog
    const mapSkip = page.locator('.map-dialog .btn-ghost, .map-dialog .btn-primary');
    if (await mapSkip.count()) await mapSkip.first().click();
    const node = page.locator(`.node[aria-label^="${level.title.replace(/"/g, '\\"')} ("]`);
    await node.first().scrollIntoViewIfNeeded();
    await node.first().click();
    await page.click('.level-card-actions .btn-primary');
    await page.waitForTimeout(300);
    const storySkip = page.locator('.level-dialog .btn-ghost, .level-dialog .btn-primary');
    if (await storySkip.count()) await storySkip.first().click();
    await page.waitForTimeout(200);
    let ok = false;
    let detail = '';
    try {
      if (level.type === 'quiz') {
        for (const q of level.questions) {
          await page.locator('.quiz-option').nth(q.answer).click();
          await page.locator('.quiz-actions .btn-primary').click();
          await page.waitForTimeout(80);
        }
        await page.waitForSelector('.victory', { timeout: 5000 });
        ok = true;
      } else {
        await page.click('.cm-content');
        await page.keyboard.press('Control+A');
        await page.keyboard.insertText(level.solution);
        await page.waitForTimeout(700);
        await page.click('button:has-text("Check quest")');
        await page.waitForSelector('.victory, .objectives li.fail', { timeout: 15000 });
        if (await page.locator('.victory').count()) ok = true;
        else detail = (await page.locator('.objectives').innerText()).replace(/\s+/g, ' ').slice(0, 300);
      }
    } catch (err) {
      detail = err.message.split('\n')[0];
    }
    played++;
    if (!ok) failures++;
    console.log(`  ${ok ? '✓' : '✗'} ${level.title}${detail ? ' — ' + detail : ''}`);
  }
}
console.log(`\n${played} levels played, ${failures} failed. Page errors: ${pageErrors.length}`);
if (pageErrors.length) console.log(pageErrors.slice(0, 5).join('\n'));
await browser.close();
process.exit(failures ? 1 : 0);
