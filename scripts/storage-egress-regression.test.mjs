import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chatRoom = await readFile(new URL('../src/ChatRoom.jsx', import.meta.url), 'utf8');
const viewportImage = await readFile(new URL('../src/ViewportChatImage.jsx', import.meta.url), 'utf8');

test('historical chat images are rendered through the viewport gate', () => {
  assert.match(chatRoom, /<ViewportChatImage\s+src=\{m\.image\}/);
  assert.doesNotMatch(chatRoom, /<img\s+src=\{m\.image\}/);
});

test('viewport gate does not assign image src until IntersectionObserver admits it', () => {
  assert.match(viewportImage, /IntersectionObserver/);
  assert.match(viewportImage, /root:\s*rootRef\?\.current\s*\|\|\s*null/);
  assert.match(viewportImage, /rootMargin:\s*ROOT_MARGIN/);
  assert.match(viewportImage, /\{ready\s*&&\s*\(/);
  assert.match(viewportImage, /fetchPriority="low"/);
});

test('recent upload preview remains immediate and is not routed through historical lazy gate', () => {
  assert.match(chatRoom, /<img\s+src=\{pendingFile\.url\}/);
});
