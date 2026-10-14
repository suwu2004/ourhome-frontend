export function mergeRefreshedMessages(currentMessages, refreshedMessages) {
  const current = Array.isArray(currentMessages) ? currentMessages : [];
  const refreshed = Array.isArray(refreshedMessages) ? refreshedMessages : [];
  const refreshedById = new Map(
    refreshed
      .filter(message => message && message.id != null)
      .map(message => [String(message.id), message]),
  );
  const existingIds = new Set(
    current
      .filter(message => message && message.id != null)
      .map(message => String(message.id)),
  );

  const merged = current.map(message => {
    if (!message || message.id == null) return message;
    const fresh = refreshedById.get(String(message.id));
    if (!fresh) return message;
    return {
      ...message,
      ...fresh,
      // Preserve the local UI state for an already-open reasoning panel.
      thinkingOpen: Boolean(message.thinkingOpen || fresh.thinkingOpen),
    };
  });

  for (const message of refreshed) {
    if (!message || message.id == null || !existingIds.has(String(message.id))) {
      merged.push(message);
    }
  }

  return merged
    .map((message, index) => ({
      message,
      index,
      timestamp: Date.parse(message?.createdAt || ''),
    }))
    .sort((left, right) => {
      const leftHasTimestamp = Number.isFinite(left.timestamp);
      const rightHasTimestamp = Number.isFinite(right.timestamp);
      if (leftHasTimestamp && rightHasTimestamp && left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }
      if (leftHasTimestamp !== rightHasTimestamp) return leftHasTimestamp ? -1 : 1;
      return left.index - right.index;
    })
    .map(entry => entry.message);
}
