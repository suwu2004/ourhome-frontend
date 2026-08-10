from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

# fonts.js: load only the selected/requested face and dedupe concurrent imports.
path = Path('src/fonts.js')
text = path.read_text()
text = replace_once(
    text,
    """// The decorative home shell already loads the brush face once in Root.jsx.
// Mark it ready here so the settings preview does not import the same 2.7 MB face again.
const loaded = new Set(['system', 'brush']);

async function loadFontFiles(key) {
  if (loaded.has(key)) return;
  if (key === 'round') await import('@fontsource/zcool-kuaile/chinese-simplified-400.css');
  if (key === 'serif') await import('@fontsource/noto-serif-sc/chinese-simplified-400.css');
  loaded.add(key);
}

export async function preloadFontOptions() {
  const optionalFonts = Object.keys(FONT_STYLES).filter(key => key !== 'system' && !loaded.has(key));
  for (const key of optionalFonts) {
    await new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(resolve, { timeout: 1200 });
      } else {
        window.setTimeout(resolve, 80);
      }
    });
    await loadFontFiles(key);
  }
}
""",
    """const loaded = new Set(['system']);
const loading = new Map();

async function loadFontFiles(key) {
  if (loaded.has(key)) return;
  if (!FONT_STYLES[key]) return;
  let pending = loading.get(key);
  if (!pending) {
    pending = (async () => {
      if (key === 'round') await import('@fontsource/zcool-kuaile/chinese-simplified-400.css');
      if (key === 'serif') await import('@fontsource/noto-serif-sc/chinese-simplified-400.css');
      if (key === 'brush') await import('@fontsource/ma-shan-zheng/chinese-simplified-400.css');
      loaded.add(key);
    })().finally(() => loading.delete(key));
    loading.set(key, pending);
  }
  await pending;
}

export function ensureFontLoaded(key) {
  return loadFontFiles(key);
}
""",
    'make font loading demand-driven',
)
path.write_text(text)

# App.jsx: opening Settings must not eagerly download every optional Chinese face.
path = Path('src/App.jsx')
text = path.read_text()
text = replace_once(
    text,
    "import { FONT_STYLES, applyAppFont, getSavedFont, preloadFontOptions } from './fonts.js';",
    "import { FONT_STYLES, applyAppFont, getSavedFont } from './fonts.js';",
    'remove preload import',
)
text = replace_once(
    text,
    """  useEffect(() => {
    if (view !== 'settings') return;
    preloadFontOptions().catch(console.error);
    refreshTheme({ refreshAssets: true }).catch(console.error);
  }, [refreshTheme, view]);
""",
    """  useEffect(() => {
    if (view !== 'settings') return;
    refreshTheme({ refreshAssets: true }).catch(console.error);
  }, [refreshTheme, view]);
""",
    'stop settings font preload',
)
path.write_text(text)

# Root.jsx: brush is no longer a global first-load dependency.
path = Path('src/Root.jsx')
text = path.read_text()
text = replace_once(
    text,
    "import '@fontsource/ma-shan-zheng/chinese-simplified-400.css';\n",
    '',
    'remove global brush import',
)
path.write_text(text)

# Luze room explicitly requests the decorative brush face only when that room mounts.
path = Path('src/LuzePrivateRoom.jsx')
text = path.read_text()
text = replace_once(
    text,
    "import { useTheme } from './ThemeContext.jsx';\n",
    "import { useTheme } from './ThemeContext.jsx';\nimport { ensureFontLoaded } from './fonts.js';\n",
    'import lazy brush loader',
)
text = replace_once(
    text,
    """  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);

  const roomFetch = useCallback(async (path, options = {}) => {
""",
    """  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    ensureFontLoaded('brush').catch(error => console.warn('[font] brush face failed to load:', error));
  }, []);

  const roomFetch = useCallback(async (path, options = {}) => {
""",
    'load brush on Luze room mount',
)
path.write_text(text)

# Settings previews warm a face only when the user actually points/focuses it.
path = Path('src/SettingsRoom.jsx')
text = path.read_text()
text = replace_once(
    text,
    "import { FONT_STYLES } from './fonts.js';",
    "import { FONT_STYLES, ensureFontLoaded } from './fonts.js';",
    'import font warmer',
)
text = replace_once(
    text,
    """<button type=\"button\" aria-pressed={fontStyle === key} key={key} onClick={() => changeFontStyle(key)} style={{ fontFamily: FONT_STYLES[key].family, fontSize: 12.5, padding: \"6px 12px\", borderRadius: 999, cursor: \"pointer\", color: fontStyle === key ? C.honeyDeep : C.text, background: fontStyle === key ? C.honeyLight : C.cream, border: `1px solid ${fontStyle === key ? C.honeyDeep : C.border}` }}>{FONT_STYLES[key].label}</button>""",
    """<button type=\"button\" aria-pressed={fontStyle === key} key={key} onPointerEnter={() => ensureFontLoaded(key).catch(() => {})} onFocus={() => ensureFontLoaded(key).catch(() => {})} onClick={() => changeFontStyle(key)} style={{ fontFamily: FONT_STYLES[key].family, fontSize: 12.5, padding: \"6px 12px\", borderRadius: 999, cursor: \"pointer\", color: fontStyle === key ? C.honeyDeep : C.text, background: fontStyle === key ? C.honeyLight : C.cream, border: `1px solid ${fontStyle === key ? C.honeyDeep : C.border}` }}>{FONT_STYLES[key].label}</button>""",
    'warm hovered/focused preview only',
)
path.write_text(text)

# Add a focused regression test and include it in test:app.
test_path = Path('scripts/font-loading-regression.test.mjs')
test_path.write_text(r'''import test from 'node:test';
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
''')

path = Path('package.json')
text = path.read_text()
text = replace_once(
    text,
    'scripts/data-room-polish-regression.test.mjs scripts/android-update-progress-regression.test.mjs',
    'scripts/data-room-polish-regression.test.mjs scripts/android-update-progress-regression.test.mjs scripts/font-loading-regression.test.mjs',
    'include font regression in test app',
)
path.write_text(text)
