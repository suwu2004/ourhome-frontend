import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contextSource = readFileSync(new URL('../src/MusicPlayerContext.jsx', import.meta.url), 'utf8');
const roomSource = readFileSync(new URL('../src/MusicRoom.jsx', import.meta.url), 'utf8');

test('re-entering Together Listening preserves a newer local pause intent', () => {
  assert.match(contextSource, /keepLocalIntent/);
  assert.match(contextSource, /localUpdatedAt >= remoteUpdatedAt/);
  assert.match(contextSource, /is_playing: Boolean\(localState\.is_playing\)/);
});

test('QQ Music share links prefer the app on mobile and fall back to web', () => {
  assert.match(roomSource, /qqmusic:\/\/qq\.com\/media\/playSonglist/);
  assert.match(roomSource, /songDetail\|song/);
  assert.match(roomSource, /document\.visibilityState === 'visible'/);
  assert.match(roomSource, /900/);
});
