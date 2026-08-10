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
