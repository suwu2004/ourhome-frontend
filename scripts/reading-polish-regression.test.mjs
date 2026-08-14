import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const room = fs.readFileSync(new URL('../src/ReadingRoom.jsx', import.meta.url), 'utf8');
const annotations = fs.readFileSync(new URL('../src/ReadingAnnotations.css', import.meta.url), 'utf8');
const companion = fs.readFileSync(new URL('../src/ReadingCompanionPanel.jsx', import.meta.url), 'utf8');
const companionCss = fs.readFileSync(new URL('../src/ReadingCompanionPanel.css', import.meta.url), 'utf8');
const headers = fs.readFileSync(new URL('../src/UnifiedRoomHeaders.css', import.meta.url), 'utf8');

test('mobile text selection opens paragraph-scoped annotations', () => {
  assert.match(room, /selectionchange/);
  assert.match(room, /onTouchEnd=\{\(\) => captureSelection\(280\)\}/);
  assert.match(room, /reading-paragraph-note-toggle/);
  assert.match(room, /setOpenParagraphIndex\(Number\(data\.paragraph_index\)\)/);
  assert.match(room, /color: 'blush'/);
});

test('paragraph threads distinguish Tantan and Luze', () => {
  assert.match(annotations, /\.reading-paragraph-bubble\.is-tantan[\s\S]*#f7e7e3/);
  assert.match(annotations, /\.reading-paragraph-bubble\.is-luze[\s\S]*#eaf2fb/);
});

test('reading companion is a compact shared Chat without the old workbench', () => {
  assert.match(companion, /const SESSION_KEY = 'ourhome_session_id'/);
  assert.match(companion, /postJson\('\/chat'/);
  assert.match(companion, /边读边聊/);
  assert.doesNotMatch(companion, /预读工作台|tokenCount|workbench/);
  assert.match(companionCss, /height: min\(72dvh, 680px\)/);
  assert.match(companionCss, /grid-template-columns: repeat\(3, 1fr\)/);
});

test('reading back buttons use the shared transparent navigation style', () => {
  assert.match(headers, /reading-shelf-header > button:first-child/);
  assert.match(headers, /reading-reader-header > button:first-child/);
  assert.match(headers, /background: transparent !important/);
});
