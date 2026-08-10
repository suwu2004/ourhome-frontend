import { useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';

function totals(status) {
  const tables = Array.isArray(status?.tables) ? status.tables : [];
  return tables.reduce((sum, row) => ({
    changes: sum.changes + (Number(row?.pending_changes) || 0),
    rows: sum.rows + (Number(row?.pending_rows) || 0),
  }), { changes: 0, rows: 0 });
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function readStatus() {
  const response = await apiFetch(`${BACKEND}/failover/status`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || '备用库状态暂时没有取回来');
  return data;
}

export default function FailoverRecoverySettings({ active = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const pending = useMemo(() => totals(status), [status]);
  const pendingObjects = Number(status?.pending_objects) || 0;
  const pendingSecrets = Number(status?.pending_secrets) || 0;
  const hasPending = pending.changes > 0 || pendingObjects > 0 || pendingSecrets > 0;
  const primaryReady = status?.primary_ready === true;

  const refresh = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const next = await readStatus();
      setStatus(next);
      return next;
    } catch (nextError) {
      setError(nextError?.message || '备用库状态暂时没有取回来');
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    refresh({ quiet: true });
  }, [active]);

  const recover = async () => {
    setNotice('');
    setError('');
    const checked = await refresh();
    if (!checked) return;
    if (checked.primary_ready !== true) {
      setNotice(`Supabase REST 还没有恢复${checked.primary_status ? `（HTTP ${checked.primary_status}）` : ''}，现在继续由 Neon 守着。`);
      return;
    }
    const checkedTotals = totals(checked);
    const checkedPending = checkedTotals.changes + (Number(checked.pending_objects) || 0) + (Number(checked.pending_secrets) || 0);
    if (!checkedPending) {
      setNotice('Neon 里没有待回灌内容，主库已经是完整状态。');
      return;
    }
    if (!window.confirm('确认开始安全回灌吗？会先搬文件，再搬数据；遇到主库更新冲突会立刻停下并保留 Neon 原件。')) return;

    setRecovering(true);
    try {
      let current = checked;
      for (let batch = 0; batch < 12; batch += 1) {
        const response = await apiFetch(`${BACKEND}/failover/replay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmation: 'supabase-restored', limit: 1000 }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error || '安全回灌没有完成');
        if (Array.isArray(result?.failed) && result.failed.length) {
          throw new Error(result.failed[0]?.error || '发现数据冲突，已经安全暂停回灌');
        }
        current = await readStatus();
        setStatus(current);
        const remaining = totals(current);
        if (remaining.changes === 0 && Number(current.pending_objects || 0) === 0 && Number(current.pending_secrets || 0) === 0) break;
      }
      const remaining = totals(current);
      if (remaining.changes || Number(current.pending_objects || 0) || Number(current.pending_secrets || 0)) {
        setNotice('已经搬完一轮，Neon 里还有少量内容待处理；可以再次点安全回灌。');
      } else {
        setNotice('回灌完成啦。Supabase 已重新接住主数据，Neon 继续留作灾备。');
      }
    } catch (nextError) {
      setError(nextError?.message || '安全回灌没有完成，Neon 原件仍然保留着。');
    } finally {
      setRecovering(false);
    }
  };

  const primaryText = status == null
    ? '尚未检查'
    : primaryReady
      ? 'Supabase REST 已恢复'
      : `Supabase REST 未恢复${status.primary_status ? ` · HTTP ${status.primary_status}` : ''}`;

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(196,151,74,.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700 }}>主库与灾备</div>
          <div style={{ marginTop: 2, fontSize: 9.5, opacity: .68, lineHeight: 1.45 }}>{primaryText}</div>
          {status && (
            <div style={{ marginTop: 2, fontSize: 9.5, opacity: .68, lineHeight: 1.45 }}>
              Neon 待回灌 {pending.rows} 行 / {pending.changes} 次变更 · 文件 {pendingObjects} 个{pendingObjects ? ` / ${formatBytes(status.pending_object_bytes)}` : ''}
              {pendingSecrets ? ` · 密钥 ${pendingSecrets}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={() => refresh()} disabled={loading || recovering} style={{ padding: '6px 9px', borderRadius: 999, border: '1px solid rgba(196,151,74,.35)', background: 'transparent', fontSize: 9.5, cursor: loading || recovering ? 'default' : 'pointer' }}>{loading ? '检查中…' : '检查'}</button>
          <button type="button" onClick={recover} disabled={loading || recovering || !primaryReady || !hasPending || pendingSecrets > 0} style={{ padding: '6px 10px', borderRadius: 999, border: 0, background: primaryReady && hasPending && pendingSecrets === 0 ? '#C9974A' : 'rgba(196,151,74,.18)', color: primaryReady && hasPending && pendingSecrets === 0 ? '#fff' : 'inherit', fontSize: 9.5, cursor: loading || recovering || !primaryReady || !hasPending || pendingSecrets > 0 ? 'default' : 'pointer' }}>{recovering ? '回灌中…' : '安全回灌'}</button>
        </div>
      </div>
      {notice && <div role="status" style={{ marginTop: 6, fontSize: 9.5, lineHeight: 1.45, opacity: .78 }}>{notice}</div>}
      {error && <div role="alert" style={{ marginTop: 6, fontSize: 9.5, lineHeight: 1.45, color: '#B86055' }}>{error}</div>}
    </div>
  );
}
