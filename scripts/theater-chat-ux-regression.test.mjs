import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/TheaterRoom.jsx', import.meta.url), 'utf8');

test('existing configured theater worlds open directly into chat', () => {
  assert.match(source, /hasWorldSetup/);
  assert.match(source, /hasStory/);
  assert.match(source, /setBookPane\(pane \|\| \(\(hasWorldSetup \|\| hasStory\) \? 'chat' : 'settings'\)\)/);
  assert.match(source, /setBookPane\('settings'\)/); // new blank worlds still start in setup
});

test('theater model selector lives with the composer like main Chat', () => {
  const composerIndex = source.indexOf('发送小剧场消息');
  const modelIndex = source.indexOf('选择小剧场模型');
  const settingsIndex = source.indexOf("onClick={() => setBookPane('settings')}");
  assert.ok(composerIndex > 0);
  assert.ok(modelIndex > composerIndex);
  assert.ok(settingsIndex > 0 && settingsIndex < composerIndex);
});

test('jump-to-latest sits in its own row above the composer', () => {
  const latestIndex = source.indexOf('aria-label="跳到小剧场最新消息"');
  const rowIndex = source.indexOf('className="theater-latest-row"');
  const composerIndex = source.indexOf('aria-label="发送小剧场消息"');
  assert.ok(rowIndex > 0 && latestIndex > rowIndex);
  assert.ok(latestIndex < composerIndex);
  const latestButton = source.slice(latestIndex, composerIndex);
  assert.doesNotMatch(latestButton, /position:\s*'absolute'/);
});

test('theater preserves old-story reading position and only offers latest when needed', () => {
  assert.match(source, /onScroll=\{handleChatScroll\}/);
  assert.match(source, /messages\.length > 3 && !nearLatest/);
  assert.match(source, /if \(bookPane !== 'chat' \|\| !nearLatestRef\.current\) return/);
  assert.match(source, /scrollHeight - node\.scrollTop - node\.clientHeight < 72/);
});
