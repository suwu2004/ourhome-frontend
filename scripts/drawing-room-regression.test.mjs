import test from 'node:test';
import assert from 'node:assert/strict';

const read = async path => (await import('node:fs/promises')).readFile(new URL(path, import.meta.url), 'utf8');

const [root, home, drawing, grid] = await Promise.all([
  read('../src/Root.jsx'),
  read('../src/HomeHub.jsx'),
  read('../src/DrawingRoom.jsx'),
  read('../src/HomeRoomGrid.css'),
]);

test('drawing room is a first-class OurHome room with a home entry', () => {
  assert.match(root, /DrawingRoom/);
  assert.match(root, /'drawing'/);
  assert.match(home, /home-room-app--drawing/);
  assert.match(home, />画画<\/strong>/);
  assert.match(grid, /grid-area:\s*drawing/);
});

test('drawing room keeps one-sentence generation with private cloud mini-album controls', () => {
  assert.match(drawing, /\/drawing\/generate/);
  assert.match(drawing, /\/drawing\/history\?limit=/);
  assert.match(drawing, /X-OurHome-Request-Id/);
  assert.match(drawing, /想画什么，就告诉我/);
  assert.match(drawing, /小画册/);
  assert.match(drawing, /保存到本地/);
  assert.match(drawing, /method: 'DELETE'/);
  assert.match(drawing, /和光影相册各自安静保存/);
  assert.doesNotMatch(drawing, /ourhome:drawing-history:v1/);
  assert.doesNotMatch(drawing, /之后再接进光影相册/);
  assert.match(drawing, /画笔暂时没有接上生图接口/);
});

test('drawing room uses the direct Render backend so Vercel /api rewrites cannot swallow drawing mutations', () => {
  assert.match(drawing, /DIRECT_BACKEND/);
  assert.match(drawing, /DRAWING_BACKEND/);
  assert.match(drawing, /drawingUrl\('\/drawing\/generate'\)/);
  assert.match(drawing, /drawingUrl\(`\/drawing\/history/);
  assert.doesNotMatch(drawing, /apiFetch\(\`\$\{BACKEND\}\/drawing\/generate/);
});
