import { LIGHT_THEME } from './theme.js';

export function Stars({ theme = LIGHT_THEME }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${theme.border})` }} />
      <span style={{ fontSize: 9, color: theme.muted, letterSpacing: 7, userSelect: "none" }}>✦ ✦ ✦</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${theme.border})` }} />
    </div>
  );
}

// History timestamps are transport metadata for the model, not part of the
// conversational bubble. Older replies may already contain one or more copies
// because the same history was annotated again on a later turn, so clean every
// exact marker at render time without mutating the stored message.
const HISTORY_TIMELINE_MARKER_RE = /(?:^|\n)\s*\[历史时间[：:]\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\]\s*/g;

function displayMessageText(text) {
  return String(text || '').replace(HISTORY_TIMELINE_MARKER_RE, (match, offset) => offset === 0 ? '' : '\n');
}

export function HighlightedText({ text, query }) {
  const value = displayMessageText(text);
  const keyword = String(query || '').trim();
  if (!keyword) return value;
  const parts = [];
  const lower = value.toLocaleLowerCase('zh-CN');
  const needle = keyword.toLocaleLowerCase('zh-CN');
  let cursor = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    if (index > cursor) parts.push(value.slice(cursor, index));
    parts.push(<mark className="search-match" key={`${index}-${parts.length}`}>{value.slice(index, index + keyword.length)}</mark>);
    cursor = index + keyword.length;
    index = lower.indexOf(needle, cursor);
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts.length ? parts : value;
}
