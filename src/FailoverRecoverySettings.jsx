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
  const blockedBySecrets = pendingSecrets > 0;
  const canReplay = primaryReady && hasPending && !blockedBySecrets;

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

  const replay = async (checked) => {
    if (!window.confirm('确认开始安全回灌吗？会先搬文件，再搬数据；遇到主库更新冲突会立刻停下并保留 Neon 原件。')) return;
    setRecovering(true);
    setNotice('');
    setError('');
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
        setNotice('已经搬完一轮，Neon 里还有少量内容待处理，可以再检查一次。');
      } else {
        setNotice('回灌完成啦。Supabase 已重新接住主数据，Neon 继续留作灾备。');
      }
    } catch (nextError) {
      setError(nextError?.message || '安全回灌没有完成，Neon 原件仍然保留着。');
    } finally {
      setRecovering(false);
    }
  };

  const handleAction = async () => {
    if (recovering || loading) return;
    const checked = await refresh();
    if (!checked) return;
    const checkedPending = totals(checked);
    const pendingCount = checkedPending.changes + (Number(checked.pending_objects) || 0) + (Number(checked.pending_secrets) || 0);

    if (checked.primary_ready !== true) {
      setNotice(`主库暂时还不能回灌${checked.primary_status ? `（HTTP ${checked.primary_status}）` : ''}，Neon 会继续守着数据。`);
      return;
    }
    if (Number(checked.pending_secrets) > 0) {
      setNotice('还有密钥类变更待处理，暂时不自动回灌。可以稍后重新检查。');
      return;
    }
    if (!pendingCount) {
      setNotice('主库已经完整，Neon 目前没有待回灌内容。');
      return;
    }
    await replay(checked);
  };

  const primaryText = status == null
    ? '还没有检查主库'
    : primaryReady
      ? 'Supabase 主库已恢复'
      : `Supabase 主库未恢复${status.primary_status ? ` · HTTP ${status.primary_status}` : ''}`;

  const actionLabel = recovering
    ? '回灌中…'
    : loading
      ? '检查中…'
      : status == null
        ? '检查回灌'
        : canReplay
          ? '安全回灌'
          : primaryReady && !hasPending
            ? '再检查一次'
            : '重新试试';

  return (
    <section className="failover-recovery-card" style={{ padding: '12px 13px', border: '1px solid rgba(196,151,74,.22)', borderRadius: 14, background: 'rgba(255,255,255,.46)' }}>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 700 }}>主库与灾备</div>
        <div style={{ marginTop: 3, fontSize: 9.8, opacity: .72, lineHeight: 1.5 }}>{primaryText}</div>
        {status && (
          <div style={{ marginTop: 3, fontSize: 9.5, opacity: .68, lineHeight: 1.5 }}>
            Neon 待回灌 {pending.rows} 行 / {pending.changes} 次变更 · 文件 {pendingObjects} 个{pendingObjects ? ` / ${formatBytes(status.pending_object_bytes)}` : ''}
            {pendingSecrets ? ` · 密钥 ${pendingSecrets}` : ''}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleAction}
        disabled={loading || recovering}
        style={{ marginTop: 10, minWidth: 94, padding: '7px 12px', borderRadius: 999, border: 0, background: canReplay ? '#C9974A' : 'rgba(196,151,74,.18)', color: canReplay ? '#fff' : 'inherit', fontSize: 9.8, cursor: loading || recovering ? 'default' : 'pointer' }}
      >{actionLabel}</button>

      {notice && <div role="status" style={{ marginTop: 7, fontSize: 9.5, lineHeight: 1.5, opacity: .8 }}>{notice}</div>}
      {error && <div role="alert" style={{ marginTop: 7, fontSize: 9.5, lineHeight: 1.5, color: '#B86055' }}>{error}</div>}
    </section>
  );
}
