import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeRefreshedMessages } from '../src/chatHistoryRefresh.js';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const roomSource = readFileSync(new URL('../src/ChatRoom.jsx', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('../src/ChatSearchPanel.jsx', import.meta.url), 'utf8');

test('Chat defaults to a bounded recent history page and can load older messages', () => {
  assert.match(appSource, /CHAT_HISTORY_PAGE_SIZE = 240/);
  assert.match(appSource, /\?limit=\$\{CHAT_HISTORY_PAGE_SIZE\}/);
  assert.match(appSource, /const loadOlderMessages = async \(\) =>/);
  assert.match(roomSource, /查看更早的消息/);
});

test('search and notification jumps load only a bounded neighborhood around an old target', () => {
  assert.match(appSource, /messages\/context\?message_id=\$\{encodeURIComponent\(targetMessageId\)\}&before=1000&after=1000/);
  assert.match(appSource, /switchSession\(r\.session_id, \{ aroundMessageId: r\.id \}\)/);
  assert.match(appSource, /loadMessagesFor\(sessionId, \{ aroundMessageId: r\.id \}\)/);
});

test('chat search opens on all conversations instead of silently limiting old-history searches to the current thread', () => {
  assert.match(searchSource, /const wasOpenRef = useRef\(false\)/);
  assert.match(searchSource, /open && !wasOpenRef\.current && scope !== 'all'/);
  assert.ok(searchSource.indexOf("['all', '全部对话']") < searchSource.indexOf("['current', '当前对话']"));
  assert.match(searchSource, /当前对话里没找到。可以切到“全部对话”继续找。/);
});

test('session preview cache stays bounded after deep history browsing', () => {
  assert.match(roomSource, /MAX_CACHED_MESSAGES_PER_SESSION = 320/);
  assert.match(roomSource, /stableMessages\.slice\(-MAX_CACHED_MESSAGES_PER_SESSION\)/);
});

test('Chat exposes a guarded refresh action for the current conversation', () => {
  assert.match(roomSource, /aria-label="刷新当前对话"/);
  assert.match(roomSource, /await refreshMessages\(\)/);
  assert.match(roomSource, /chatRefreshBlocked = chatRefreshing \\|\\| regenerating \\|\\| messageActionLoading \\|\\| imageUploading \\|\\| chatHistoryLoading/);
  assert.match(roomSource, /if \(!sessionId \|\| chatRefreshBlocked \|\| !refreshMessages\) return/);
  assert.match(appSource, /refreshMessages=\{\(\) => loadMessagesFor\(sessionId, \{ preserveLoadedHistory: true \}\)\}/);
});

test('Chat keeps refresh at the far right of search', () => {
  const searchIndex = roomSource.indexOf('aria-label="搜索聊天记录"');
  const refreshIndex = roomSource.indexOf('aria-label="刷新当前对话"');
  assert.ok(searchIndex > 0 && refreshIndex > searchIndex);
});

test('refresh merges recent server messages without dropping loaded older history or duplicating IDs', () => {
  const existing = [
    { id: 'old-1', role: 'me', text: 'older loaded message', createdAt: '2026-10-01T10:00:00Z' },
    { id: 'recent-1', role: 'ai', text: 'old copy', createdAt: '2026-10-02T10:00:00Z', thinkingOpen: true },
  ];
  const refreshed = [
    { id: 'recent-1', role: 'ai', text: 'updated copy', createdAt: '2026-10-02T10:00:00Z', thinkingOpen: false },
    { id: 'recent-2', role: 'me', text: 'new message', createdAt: '2026-10-03T10:00:00Z' },
    { id: 'recent-2', role: 'me', text: 'new message', createdAt: '2026-10-03T10:00:00Z' },
  ];

  const merged = mergeRefreshedMessages(existing, refreshed);
  assert.deepEqual(merged.map(message => message.id), ['old-1', 'recent-1', 'recent-2']);
  assert.equal(merged[0].text, 'older loaded message');
  assert.equal(merged[1].text, 'updated copy');
  assert.equal(merged[1].thinkingOpen, true);
  assert.equal(merged[2].text, 'new message');
});
