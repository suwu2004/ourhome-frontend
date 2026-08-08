import { useEffect, useState } from 'react';

function findSettingsGroup({ key, title }) {
  const roots = Array.from(document.querySelectorAll('.ourhome-scroll'));

  for (const root of roots) {
    const tagged = root.querySelector(`section[data-settings-group-key="${key}"]`);
    if (tagged) return tagged;

    const sections = Array.from(root.querySelectorAll('section'));
    const section = sections.find(item => {
      const heading = item.querySelector(':scope > button strong');
      return String(heading?.textContent || '').trim() === title;
    }) || null;

    if (section) {
      section.dataset.settingsGroupKey = key;
      return section;
    }
  }

  return null;
}

function decorateGroup(section, { displayTitle, displaySubtitle }) {
  if (!section) return;
  const titleNode = section.querySelector(':scope > button strong');
  const subtitleNode = section.querySelector(':scope > button small');

  if (displayTitle && titleNode && titleNode.textContent !== displayTitle) titleNode.textContent = displayTitle;
  if (displaySubtitle && subtitleNode && subtitleNode.textContent !== displaySubtitle) subtitleNode.textContent = displaySubtitle;
}

export function useSettingsGroupTarget({ key, title, displayTitle = '', displaySubtitle = '' }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let frame = 0;
    const findTarget = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const section = findSettingsGroup({ key, title });
        decorateGroup(section, { displayTitle, displaySubtitle });
        const next = section?.querySelector(':scope > div:last-child') || null;
        setTarget(current => current === next ? current : next);
      });
    };

    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    findTarget();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [key, title, displayTitle, displaySubtitle]);

  return target && document.body.contains(target) ? target : null;
}
