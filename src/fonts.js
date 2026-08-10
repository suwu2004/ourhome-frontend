export const FONT_STORAGE_KEY = 'ourhome_font_style';

export const FONT_STYLES = {
  system: {
    label: '跟随系统',
    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  round: {
    label: '圆体可爱',
    family: '"ZCOOL KuaiLe", system-ui, sans-serif',
  },
  serif: {
    label: '宋体复古',
    family: '"Noto Serif SC", "Songti SC", "STSong", serif',
  },
  brush: {
    label: '手写行楷',
    family: '"Ma Shan Zheng", "Kaiti SC", "STKaiti", cursive',
  },
};

const loaded = new Set(['system']);
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

export async function applyAppFont(key, { persist = true } = {}) {
  const next = FONT_STYLES[key] ? key : 'system';
  document.documentElement.dataset.font = next;
  if (persist) localStorage.setItem(FONT_STORAGE_KEY, next);
  try {
    await loadFontFiles(next);
  } catch (error) {
    console.error(`字体 ${next} 加载失败`, error);
  }
  return next;
}

export function getSavedFont() {
  const saved = localStorage.getItem(FONT_STORAGE_KEY) || 'system';
  return FONT_STYLES[saved] ? saved : 'system';
}
