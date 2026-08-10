import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('optional Chinese fonts are demand-loaded instead of preloaded by Settings', async () => {
  const [fonts, app, root] = await Promise.all([
    read('../src/fonts.js'),
    read('../src/App.jsx'),
    read('../src/Root.jsx'),
  ]);
  assert.match(fonts, /ensureFontLoaded/);
  assert.match(fonts, /key === 'round'.*zcool-kuaile/s);
  assert.match(fonts, /key === 'serif'.*noto-serif-sc/s);
  assert.match(fonts, /key === 'brush'.*ma-shan-zheng/s);
  assert.doesNotMatch(fonts, /preloadFontOptions/);
  assert.doesNotMatch(app, /preloadFontOptions/);
  assert.doesNotMatch(root, /@fontsource\/ma-shan-zheng/);
});

test('Luze room requests its decorative brush font only when the room mounts', async () => {
  const room = await read('../src/LuzePrivateRoom.jsx');
  assert.match(room, /ensureFontLoaded\('brush'\)/);
  assert.match(room, /useEffect\(\(\) => \{\s*ensureFontLoaded\('brush'\)/s);
});

test('font picker warms only the face the user is interacting with', async () => {
  const settings = await read('../src/SettingsRoom.jsx');
  assert.match(settings, /onPointerEnter=\{\(\) => ensureFontLoaded\(key\)/);
  assert.match(settings, /onFocus=\{\(\) => ensureFontLoaded\(key\)/);
});
