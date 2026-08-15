import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const roomSource = readFileSync(new URL('../src/ChatRoom.jsx', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('../src/ChatSearchPanel.jsx', import.meta.url), 'utf8');

test('Chat defaults to a bounded recent history page and can load older messages', () => {
  assert.match(appSource, /CHAT_HISTORY_PAGE_SIZE = 240/);
  assert.match(appSource, /\?limit=\$\{CHAT_HISTORY_PAGE_SIZE\}/);
  assert.match(appSource, /const loadOlderMessages = async \(\) =>/);
  assert.match(roomSource, /查看更早的消息/);
});

test('search and notification jumps can request full history for an old target', () => {
  assert.match(appSource, /full: Boolean\(targetMessageId\)/);
  assert.match(appSource, /switchSession\(r\.session_id, \{ full: true \}\)/);
  assert.match(appSource, /loadMessagesFor\(sessionId, \{ full: true \}\)/);
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
  assert.match(roomSource, /chatRefreshBlocked = chatRefreshing \|\| thinking \|\| regenerating \|\| messageActionLoading \|\| imageUploading/);
  assert.match(roomSource, /if \(!sessionId \|\| chatRefreshBlocked \|\| !refreshMessages\) return/);
  assert.match(appSource, /refreshMessages=\{\(\) => loadMessagesFor\(sessionId\)\}/);
});

test('Chat keeps refresh at the far right of search', () => {
  const searchIndex = roomSource.indexOf('aria-label="搜索聊天记录"');
  const refreshIndex = roomSource.indexOf('aria-label="刷新当前对话"');
  assert.ok(searchIndex > 0 && refreshIndex > searchIndex);
});
