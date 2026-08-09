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

// The decorative home shell already loads the brush face once in Root.jsx.
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
