import { useEffect, useState } from 'react';

function findSettingsController() {
  const sections = Array.from(document.querySelectorAll('body[data-ourhome-room="settings"] .ourhome-scroll > section'));
  return sections.find(section => String(section.textContent || '').includes('家里的控制台')) || null;
}

function paintSection(section, theme) {
  if (!section || !theme) return;
  Object.assign(section.style, {
    marginBottom: '12px',
    padding: '12px',
    borderRadius: '17px',
    border: `1px solid ${theme.border}`,
    background: theme.white,
    boxShadow: 'none',
  });

  const title = section.querySelector('[data-settings-runtime-title]');
  const subtitle = section.querySelector('[data-settings-runtime-subtitle]');
  const grid = section.querySelector('[data-settings-runtime-grid]');
  if (title) Object.assign(title.style, { color: theme.text });
  if (subtitle) Object.assign(subtitle.style, { color: theme.muted });
  if (grid) Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '8px',
    marginTop: '10px',
  });
}

function ensureSettingsRuntimeTarget(theme) {
  const controller = findSettingsController();
  if (!controller?.parentElement) return null;

  let section = controller.parentElement.querySelector(':scope > [data-settings-runtime-section="true"]');
  if (!section) {
    section = document.createElement('section');
    section.dataset.settingsRuntimeSection = 'true';

    const heading = document.createElement('div');
    heading.style.display = 'flex';
    heading.style.alignItems = 'flex-start';
    heading.style.justifyContent = 'space-between';
    heading.style.gap = '12px';

    const copy = document.createElement('div');
    const title = document.createElement('div');
    title.dataset.settingsRuntimeTitle = 'true';
    title.textContent = '运行与自主性';
    Object.assign(title.style, { fontSize: '13px', fontWeight: '700', letterSpacing: '.05em' });

    const subtitle = document.createElement('div');
    subtitle.dataset.settingsRuntimeSubtitle = 'true';
    subtitle.textContent = '陆泽自己的行动设置，以及 API 调用与花费记录。';
    Object.assign(subtitle.style, { marginTop: '3px', fontSize: '9.5px', lineHeight: '1.5' });

    const grid = document.createElement('div');
    grid.dataset.settingsRuntimeGrid = 'true';

    copy.append(title, subtitle);
    heading.append(copy);
    section.append(heading, grid);
    controller.insertAdjacentElement('afterend', section);
  }

  paintSection(section, theme);
  return section.querySelector('[data-settings-runtime-grid]');
}

export function useSettingsRuntimeTarget(theme) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let frame = 0;
    const findTarget = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = ensureSettingsRuntimeTarget(theme);
        setTarget(current => current === next ? current : next);
      });
    };

    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    findTarget();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [theme]);

  return target && document.body.contains(target) ? target : null;
}
