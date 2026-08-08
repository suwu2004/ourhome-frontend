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

function portalTargetFor(content, { key, position }) {
  if (!content || position !== 'start') return content || null;

  const marker = `settings-${key}-start`;
  let mount = content.querySelector(`:scope > [data-settings-portal="${marker}"]`);
  if (!mount) {
    mount = document.createElement('div');
    mount.dataset.settingsPortal = marker;
    content.prepend(mount);
  } else if (content.firstElementChild !== mount) {
    content.prepend(mount);
  }
  return mount;
}

export function useSettingsGroupTarget({ key, title, displayTitle = '', displaySubtitle = '', position = 'end' }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let frame = 0;
    let ownedMount = null;

    const findTarget = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const section = findSettingsGroup({ key, title });
        decorateGroup(section, { displayTitle, displaySubtitle });
        const content = section?.querySelector(':scope > div:last-child') || null;
        const next = portalTargetFor(content, { key, position });
        if (position === 'start' && next) ownedMount = next;
        setTarget(current => current === next ? current : next);
      });
    };

    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    findTarget();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      if (position === 'start' && ownedMount?.isConnected) ownedMount.remove();
    };
  }, [key, title, displayTitle, displaySubtitle, position]);

  return target && document.body.contains(target) ? target : null;
}
