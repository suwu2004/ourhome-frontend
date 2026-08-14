import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const room = fs.readFileSync(new URL('../src/ReadingRoom.jsx', import.meta.url), 'utf8');
const annotations = fs.readFileSync(new URL('../src/ReadingAnnotations.css', import.meta.url), 'utf8');
const companion = fs.readFileSync(new URL('../src/ReadingCompanionPanel.jsx', import.meta.url), 'utf8');
const companionCss = fs.readFileSync(new URL('../src/ReadingCompanionPanel.css', import.meta.url), 'utf8');
const bookmarks = fs.readFileSync(new URL('../src/ReadingBookmarkOverlay.jsx', import.meta.url), 'utf8');
const bookmarkCss = fs.readFileSync(new URL('../src/ReadingBookmarkOverlay.css', import.meta.url), 'utf8');
const headers = fs.readFileSync(new URL('../src/UnifiedRoomHeaders.css', import.meta.url), 'utf8');

// The underlying selection storage stays compatible with the existing annotation API,
// while the visible UX now presents these selections as bookmarks.
test('mobile text selection still captures paragraph-scoped ranges', () => {
  assert.match(room, /selectionchange/);
  assert.match(room, /onTouchEnd=\{\(\) => captureSelection\(280\)\}/);
  assert.match(room, /setOpenParagraphIndex\(Number\(data\.paragraph_index\)\)/);
  assert.match(room, /color: 'blush'/);
});

test('legacy paragraph replies retain distinct Luze bubble styling', () => {
  assert.match(annotations, /\.reading-paragraph-bubble\.is-luze[\s\S]*#eaf2fb/);
  assert.match(bookmarkCss, /reading-paragraph-block:has\(\.reading-highlight\.has-luze-reply\)/);
  assert.match(bookmarkCss, /reading-paragraph-bubble\.is-tantan/);
});

test('reading companion is chat-only and names the current book', () => {
  assert.match(companion, /const SESSION_KEY = 'ourhome_session_id'/);
  assert.match(companion, /postJson\('\/chat'/);
  assert.match(companion, /《\{displayTitle\}》/);
  assert.doesNotMatch(companion, /边读边聊|reading-companion-tabs|tab === 'annotations'|tab === 'bookmarks'/);
  assert.match(companionCss, /reading-room--reader ~ \.reading-companion-fab[\s\S]*bottom: max\(116px/);
  assert.match(companionCss, /height: min\(72dvh, 680px\)/);
});

test('reading selections look like wave bookmarks and skip annotation writing UI', () => {
  assert.match(bookmarkCss, /text-decoration-style: wavy/);
  assert.match(bookmarkCss, /选中喜欢的一句，保存后会变成波浪线书签/);
  assert.match(bookmarkCss, /content: "加入书签"/);
  assert.match(bookmarkCss, /\.reading-annotation-sheet label[\s\S]*display: none !important/);
});

test('shelf star opens cross-book bookmark cards', () => {
  assert.match(bookmarks, /reading-bookmark-star/);
  assert.match(bookmarks, /\/reading\/books\/\$\{book\.id\}\/annotations/);
  assert.match(bookmarks, /book_title: book\.title/);
  assert.match(bookmarks, /chapter_title:/);
  assert.match(bookmarks, /reading-bookmark-card/);
  assert.match(bookmarks, /波浪线书签/);
});

test('reading back buttons use the shared transparent navigation style', () => {
  assert.match(headers, /reading-shelf-header > button:first-child/);
  assert.match(headers, /reading-reader-header > button:first-child/);
  assert.match(headers, /background: transparent !important/);
});
