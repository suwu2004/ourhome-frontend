import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rootSource = readFileSync(new URL('../src/Root.jsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/HomeHub.jsx', import.meta.url), 'utf8');
const musicSource = readFileSync(new URL('../src/MusicPlayerContext.jsx', import.meta.url), 'utf8');

test('home refresh emits one global sync signal', () => {
  assert.match(rootSource, /emitGlobalSync\(\{ source: 'home', scope: 'all' \}\)/);
});

test('music subscribes to global sync instead of being double-refreshed by HomeHub token', () => {
  assert.match(musicSource, /subscribeGlobalSync/);
  assert.match(musicSource, /scope: 'music'/);
  assert.match(homeSource, /useEffect\(\(\) => \{\s*loadMusicPreview\(\);\s*\}, \[loadMusicPreview\]\)/s);
  assert.doesNotMatch(homeSource, /loadMusicPreview\(\);\s*\}\, \[loadMemos, loadMilestones, loadMusicPreview, refreshToken\]\)/s);
});
