import { useCallback, useEffect, useState } from 'react';
import { getLocalFirstStats, requestPersistentLocalStorage } from './localFirstStore.js';
import { syncLocalFirstOutbox } from './api.js';

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSavedAt(value) {
  const date = new Date(Number(value) || 0);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= 0) return '还在等待首次设备保存';
  return `最近写入 ${date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
}

export default function LocalFirstSettings() {
  const [stats, setStats] = useState({ entries: 0, bytes: 0, newestAt: 0, pendingMutations: 0, replayableMutations: 0 });
  const [persistent, setPersistent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const [nextStats, kept] = await Promise.all([
        getLocalFirstStats(),
        requestPersistentLocalStorage(),
      ]);
      setStats(nextStats);
      setPersistent(kept);
    } finally {
      setChecking(false);
    }
  }, []);

  const syncPending = async () => {
    setChecking(true);
    setNotice('');
    try {
      const result = await syncLocalFirstOutbox();
      setStats(await getLocalFirstStats());
      setNotice(result.applied
        ? `已经安全同步 ${result.applied} 项，剩余 ${result.remaining} 项。`
        : result.remaining
          ? '云端还没有接住这些变更，设备副本会继续保留。'
          : '设备里没有待同步变更。');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    refresh();
    const handleUpdate = () => getLocalFirstStats().then(setStats).catch(() => {});
    window.addEventListener('ourhome-local-first-updated', handleUpdate);
    return () => window.removeEventListener('ourhome-local-first-updated', handleUpdate);
  }, [refresh]);

  return (
    <section style={{ marginTop: 12, padding: '12px 13px', border: '1px solid rgba(196,151,74,.22)', borderRadius: 14, background: 'rgba(255,255,255,.46)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700 }}>设备里的 OurHome</div>
      <div style={{ marginTop: 3, fontSize: 9.8, opacity: .72, lineHeight: 1.55 }}>
        已保留 {stats.entries} 份房间数据 · {formatBytes(stats.bytes)} · {formatSavedAt(stats.newestAt)}
      </div>
      <div style={{ marginTop: 4, fontSize: 9.3, opacity: .62, lineHeight: 1.55 }}>
        房间成功打开后会自动更新设备副本；双云受限时先用这里的数据撑起页面。
        {persistent ? ' 系统已允许长期保留。' : ' 请勿清除应用数据，否则设备副本也会被移除。'}
      </div>
      {stats.pendingMutations > 0 && (
        <div style={{ marginTop: 5, fontSize: 9.5, color: '#9A6A28', lineHeight: 1.5 }}>
          待同步变更 {stats.pendingMutations} 项
          {stats.pendingMutations > stats.replayableMutations ? ' · 含网络中断时保留的待确认内容' : ''}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
        <button
          type="button"
          onClick={refresh}
          disabled={checking}
          style={{ minWidth: 82, padding: '7px 12px', borderRadius: 999, border: 0, background: 'rgba(196,151,74,.18)', color: 'inherit', fontSize: 9.8, cursor: checking ? 'default' : 'pointer' }}
        >{checking ? '检查中…' : '检查设备副本'}</button>
        {stats.replayableMutations > 0 && (
          <button
            type="button"
            onClick={syncPending}
            disabled={checking}
            style={{ padding: '7px 12px', borderRadius: 999, border: 0, background: '#C9974A', color: '#fff', fontSize: 9.8, cursor: checking ? 'default' : 'pointer' }}
          >恢复待同步内容</button>
        )}
      </div>
      {notice && <div role="status" style={{ marginTop: 7, fontSize: 9.5, lineHeight: 1.5, opacity: .78 }}>{notice}</div>}
    </section>
  );
}
