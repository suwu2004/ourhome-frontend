import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rootSource = readFileSync(new URL('../src/Root.jsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/HomeHub.jsx', import.meta.url), 'utf8');
const musicSource = readFileSync(new URL('../src/MusicPlayerContext.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const photoSource = readFileSync(new URL('../src/PhotoMemoryRoom.jsx', import.meta.url), 'utf8');
const vaultSource = readFileSync(new URL('../src/VaultPage.jsx', import.meta.url), 'utf8');

test('home refresh emits one global sync signal', () => {
  assert.match(rootSource, /emitGlobalSync\(\{ source: 'home', scope: 'all' \}\)/);
});

test('music subscribes to global sync instead of being double-refreshed by HomeHub token', () => {
  assert.match(musicSource, /subscribeGlobalSync/);
  assert.match(musicSource, /scope: 'music'/);
  assert.match(homeSource, /useEffect\(\(\) => \{\s*loadMusicPreview\(\);\s*\}, \[loadMusicPreview\]\)/s);
  assert.doesNotMatch(homeSource, /loadMusicPreview\(\);\s*\}\, \[loadMemos, loadMilestones, loadMusicPreview, refreshToken\]\)/s);
});

test('room-scoped lightweight data revalidates when the room is actually entered', () => {
  assert.match(appSource, /const openCalendar = \(\) => \{[\s\S]*?fetchMonthEntries\(calendarMonth\);[\s\S]*?fetchSchedule\(\);[\s\S]*?fetchWishes\(\);/);
  assert.match(appSource, /if \(initialView === 'calendar'\) openCalendar\(\)/);
  assert.match(appSource, /const openCategory = \(cat\) => \{[\s\S]*?apiFetch\(`\$\{BACKEND\}\/letters\?category=\$\{encodeURIComponent\(cat\)\}`\)/);
  assert.match(photoSource, /useEffect\(\(\) => \{\s*if \(visible\) loadMemories\(\);\s*\}, \[loadMemories, visible\]\)/);
  assert.match(vaultSource, /useEffect\(\(\) => \{[\s\S]*?const connectVault = async \(\) => \{[\s\S]*?apiFetch\(`\$\{BACKEND\}\/vault`/);
});

test('hidden room views do not subscribe to the home sync and create a background request burst', () => {
  assert.doesNotMatch(appSource, /subscribeGlobalSync/);
  assert.doesNotMatch(photoSource, /subscribeGlobalSync/);
  assert.doesNotMatch(vaultSource, /subscribeGlobalSync/);
});
