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

function polishStartEntry(mount, marginBottom = 14, paddingBottom = 12) {
  const entry = mount?.firstElementChild;
  if (!entry) return;

  const divider = entry.style.borderTop;
  entry.style.marginTop = '0';
  entry.style.paddingTop = '0';
  entry.style.borderTop = '0';
  entry.style.marginBottom = '0';
  entry.style.paddingBottom = `${paddingBottom}px`;
  if (divider) entry.style.borderBottom = divider;

  // The portal mount is a real block sibling inside SettingsGroup. Putting
  // the breathing room on the mount (rather than the first child) prevents
  // the child's margin from collapsing and makes the vertical gap reliable.
  mount.style.paddingBottom = `${marginBottom}px`;
  mount.style.boxSizing = 'border-box';
  entry.dataset.settingsTopPolished = 'true';
}

export function useSettingsGroupTarget({ key, title, displayTitle = '', displaySubtitle = '', position = 'start', startGap = 14 }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let frame = 0;
    let ownedMount = null;
    let observer = null;
    let observing = false;
    let disposed = false;

    const stopObserver = () => {
      if (!observer || !observing) return;
      observer.disconnect();
      observing = false;
    };

    const findTarget = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        const section = findSettingsGroup({ key, title });
        decorateGroup(section, { displayTitle, displaySubtitle });
        const content = section?.querySelector(':scope > div:last-child') || null;
        const next = portalTargetFor(content, { key, position });
        if (position === 'start' && next) {
          ownedMount = next;
          polishStartEntry(next, startGap, startGap >= 18 ? 14 : 12);
        }
        setTarget(current => current === next ? current : next);

        // SettingsRoom stays mounted once the core App is alive.  After a
        // portal target is found there is no reason to observe every Chat DOM
        // mutation for the lifetime of the App; remounting this consumer will
        // run the lookup again if the target ever truly disappears.
        if (next) stopObserver();
        else if (!observing) {
          observer ||= new MutationObserver(findTarget);
          observer.observe(document.body, { childList: true, subtree: true });
          observing = true;
        }
      });
    };

    findTarget();

    return () => {
      disposed = true;
      stopObserver();
      cancelAnimationFrame(frame);
      if (position === 'start' && ownedMount?.isConnected) ownedMount.remove();
    };
  }, [key, title, displayTitle, displaySubtitle, position, startGap]);

  return target && document.body.contains(target) ? target : null;
}
