import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = readFileSync(new URL('../src/Root.jsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../src/HomeHub.jsx', import.meta.url), 'utf8');
const drawing = readFileSync(new URL('../src/DrawingRoom.jsx', import.meta.url), 'utf8');
const grid = readFileSync(new URL('../src/HomeRoomGrid.css', import.meta.url), 'utf8');

test('drawing room is a first-class OurHome room with a home entry', () => {
  assert.match(root, /DrawingRoom/);
  assert.match(root, /'drawing'/);
  assert.match(home, /home-room-app--drawing/);
  assert.match(home, />画画<\/strong>/);
  assert.match(grid, /grid-area:\s*drawing/);
});

test('drawing room keeps the one-sentence generation and mini-album flow', () => {
  assert.match(drawing, /\/drawing\/generate/);
  assert.match(drawing, /想画什么，就告诉我/);
  assert.match(drawing, /小画册/);
  assert.match(drawing, /ourhome:drawing-history:v1/);
  assert.match(drawing, /之后再接进光影相册/);
  assert.match(drawing, /画笔暂时没有接上生图接口/);
});
