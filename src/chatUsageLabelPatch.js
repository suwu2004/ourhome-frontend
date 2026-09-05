'use strict';

// Keep the Chat usage panel honest: input_tokens belongs to the most recent
// completed provider request, not a prediction of the next request.
const LEGACY_LABEL = '当前上下文';
const ACCURATE_LABEL = '最近一次上下文';
const LEGACY_HELP = '上下文是陆泽下一次回复会带着的聊天量；累计生成是这段对话里已经生成的 token。';
const ACCURATE_HELP = '最近一次上下文是上一轮实际送入模型的输入量；它不是下一轮的预测值。累计生成是这段对话里已经生成的 token。';

function patch(root = document) {
  const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (const node of nodes) {
    if (node.children?.length) continue;
    if (node.textContent?.trim() === LEGACY_LABEL) node.textContent = ACCURATE_LABEL;
  }
  const body = document.body;
  if (body?.textContent?.includes(LEGACY_HELP)) {
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue?.includes(LEGACY_HELP)) matches.push(walker.currentNode);
    }
    for (const textNode of matches) textNode.nodeValue = textNode.nodeValue.replace(LEGACY_HELP, ACCURATE_HELP);
  }
}

export function installChatUsageLabelPatch() {
  if (typeof document === 'undefined' || globalThis.__ourhomeChatUsageLabelPatch) return;
  globalThis.__ourhomeChatUsageLabelPatch = true;
  const run = () => patch();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
  const observer = new MutationObserver(() => patch());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
