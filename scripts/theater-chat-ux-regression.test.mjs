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

test('assistant regenerate action sits below the reply like main Chat', () => {
  const bubbleIndex = source.indexOf('{message.content}');
  const regenerateIndex = source.indexOf('↻ 重新生成');
  assert.ok(bubbleIndex > 0);
  assert.ok(regenerateIndex > bubbleIndex);
  assert.doesNotMatch(source, />重写<\/button>/);
});

test('chat header owns the book title without repeating it inside the chat pane', () => {
  assert.match(source, /selectedBook \? selectedBook\.title : '小剧场'/);
  const chatStart = source.indexOf("return (\n      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '10px");
  const composerIndex = source.indexOf('发送小剧场消息');
  const chatSlice = source.slice(chatStart, composerIndex);
  assert.ok(chatStart > 0 && composerIndex > chatStart);
  assert.doesNotMatch(chatSlice, /bookDraft\.title \|\| '未命名小剧本'/);
});

test('theater shelf uses one add menu instead of duplicate import and new-book buttons', () => {
  assert.match(source, /aria-label="添加小世界"/);
  assert.match(source, /手动创建/);
  assert.match(source, /导入文件 \/ 世界书/);
  assert.doesNotMatch(source, />导入世界<\/button>/);
  assert.doesNotMatch(source, />＋ 新书<\/button>/);
});

test('complete worldbook is primary while structured fields stay optional', () => {
  assert.match(source, /分栏补充（可选）/);
  assert.match(source, /open=\{!bookDraft\.settings\.worldbook_text\.trim\(\)\}/);
  assert.match(source, /patchStructuredSetting/);
  assert.doesNotMatch(source, /只按完整世界书读取，不强迫拆角色卡和禁区/);
  assert.match(source, /聊天背景（可选）/);
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

test('theater chat locks rapid duplicate submits and reuses the request id on retry', () => {
  assert.match(source, /if \(chatSendLockRef\.current\) return/);
  assert.match(source, /chatSendLockRef\.current = true/);
  assert.match(source, /chatSendLockRef\.current = false/);
  assert.match(source, /chatRetryRef\.current\?\.fingerprint === fingerprint/);
  assert.match(source, /'X-OurHome-Request-Id': requestId/);
  assert.match(source, /chatRetryRef\.current = null/);
});
