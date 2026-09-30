function patch(root = document) {
  const headers = root.querySelectorAll?.('header.ourhome-safe-top') || [];
  headers.forEach((header) => {
    const title = Array.from(header.querySelectorAll('div')).find((el) => el.textContent?.trim() === '陆泽');
    if (!title) return;
    const row = title.nextElementSibling;
    if (!row) return;
    const dot = row.firstElementChild;
    const label = row.querySelector('span');
    if (!dot || !label) return;
    const thinking = dot.style.boxShadow && dot.style.boxShadow !== 'none';
    const next = thinking ? '想你中…' : 'miss you';
    if (label.textContent !== next) label.textContent = next;
  });
}

export function installChatHeaderStatusPatch() {
  let scheduled = false;
  const run = () => {
    scheduled = false;
    patch(document);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(run);
  };
  patch(document);
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style'],
  });
  return () => observer.disconnect();
}
