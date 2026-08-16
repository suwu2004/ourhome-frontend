import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entrySource = readFileSync(new URL('../src/TheaterRoom.jsx', import.meta.url), 'utf8');
const source = readFileSync(new URL('../src/TheaterRoomV2.jsx', import.meta.url), 'utf8');
const actionSheetSource = readFileSync(new URL('../src/MessageActionSheet.jsx', import.meta.url), 'utf8');

test('Theater entry uses the Chat-parity implementation', () => {
  assert.match(entrySource, /TheaterRoomV2\.jsx/);
});

test('existing configured theater worlds open directly into chat', () => {
  assert.match(source, /hasWorldSetup/);
  assert.match(source, /hasStory/);
  assert.match(source, /setBookPane\(pane \|\| \(\(hasWorldSetup \|\| hasStory\) \? 'chat' : 'settings'\)\)/);
  assert.match(source, /setBookPane\('settings'\)/);
});

test('theater model controls match main Chat with local refresh and context usage', () => {
  assert.match(source, /aria-label="选择小剧场模型"/);
  assert.match(source, /aria-label="重新拉取当前 API 站点的模型"/);
  assert.match(source, /\/settings\/models/);
  assert.match(source, /◎ 上下文/);
  assert.match(source, /lastContextTokens/);
  assert.match(source, /lastOutputTokens/);
  assert.match(source, /\$\{assistantDisplayName\} · \$\{model \|\| '默认模型'\}/);
});

test('model refresh does not persist or silently switch the main Chat model', () => {
  const refreshStart = source.indexOf('const refreshModels = async () =>');
  const refreshEnd = source.indexOf('const loadBooks = async () =>', refreshStart);
  const refreshBlock = source.slice(refreshStart, refreshEnd);
  assert.match(refreshBlock, /GET|settings\/models/);
  assert.doesNotMatch(refreshBlock, /method:\s*'PATCH'/);
  assert.doesNotMatch(refreshBlock, /selected_model/);
});

test('assistant regenerate action remains below the reply like main Chat', () => {
  const bubbleIndex = source.indexOf('{message.content}');
  const regenerateIndex = source.indexOf('↻ 重新生成');
  assert.ok(bubbleIndex > 0);
  assert.ok(regenerateIndex > bubbleIndex);
  assert.doesNotMatch(source, />重写<\/button>/);
});

test('every Theater message gets the same action affordance used by Chat-style edit and rollback', () => {
  assert.match(source, /MessageActionSheet/);
  assert.match(source, /aria-label="打开小剧场消息操作"/);
  assert.match(source, /toActionMessage/);
  assert.match(source, /startEditMessage/);
  assert.match(source, /confirmRollback/);
  assert.match(source, /undoRollback/);
  assert.match(actionSheetSource, /userName = '叶檀'/);
  assert.match(actionSheetSource, /assistantName = '陆泽'/);
});

test('editing a Theater user message follows Chat semantics and restores the old branch if regeneration fails', () => {
  assert.match(source, /edit-prepare/);
  assert.match(source, /正在重新编辑这条消息/);
  assert.match(source, /修改好后重新发送/);
  assert.match(source, /hiddenIds\.length/);
  assert.match(source, /rollback\/undo/);
  const editStart = source.indexOf('const submitEditedMessage');
  const sendStart = source.indexOf('const sendChat', editStart);
  const editBlock = source.slice(editStart, sendStart);
  assert.ok(editBlock.indexOf('edit-prepare') < editBlock.indexOf('postTheaterChat'));
  assert.ok(editBlock.indexOf('postTheaterChat') < editBlock.lastIndexOf('rollback/undo'));
});

test('Theater rollback is reversible from the composer like main Chat', () => {
  assert.match(source, /\/rollback`/);
  assert.match(source, /已回到这里，收起了/);
  assert.match(source, />撤销<\/button>/);
  assert.match(source, /message_ids: rollbackUndo\.hiddenIds/);
});

test('chat header owns the book title without repeating it inside the chat pane', () => {
  assert.match(source, /selectedBook \? selectedBook\.title : '小剧场'/);
  const chatStart = source.indexOf('const renderChat =');
  const composerIndex = source.indexOf('发送小剧场消息', chatStart);
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

test('complete worldbook stays primary while structured fields remain optional', () => {
  assert.match(source, /分栏补充（可选）/);
  assert.match(source, /open=\{!bookDraft\.settings\.worldbook_text\.trim\(\)\}/);
  assert.match(source, /patchStructuredSetting/);
  assert.match(source, /聊天背景（可选）/);
});

test('jump-to-latest sits in its own row above the composer', () => {
  const latestIndex = source.indexOf('aria-label="跳到小剧场最新消息"');
  const rowIndex = source.indexOf('className="theater-latest-row"');
  const composerIndex = source.indexOf('aria-label={editingMessage', latestIndex);
  assert.ok(rowIndex > 0 && latestIndex > rowIndex);
  assert.ok(composerIndex > latestIndex);
});

test('theater preserves old-story reading position and only offers latest when needed', () => {
  assert.match(source, /onScroll=\{handleChatScroll\}/);
  assert.match(source, /messages\.length > 3 && !nearLatest/);
  assert.match(source, /if \(bookPane !== 'chat' \|\| !nearLatestRef\.current\) return/);
  assert.match(source, /scrollHeight - node\.scrollTop - node\.clientHeight < 72/);
});

test('theater chat locks rapid duplicate submits and reuses the request id on retry', () => {
  assert.match(source, /if \(!selectedBook \|\| chatSendLockRef\.current\) return/);
  assert.match(source, /chatSendLockRef\.current = true/);
  assert.match(source, /chatSendLockRef\.current = false/);
  assert.match(source, /chatRetryRef\.current\?\.fingerprint === fingerprint/);
  assert.match(source, /'X-OurHome-Request-Id': requestId/);
  assert.match(source, /chatRetryRef\.current = null/);
});
