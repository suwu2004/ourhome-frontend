import { useCallback, useEffect, useMemo, useState } from 'react';

const ACTION_COPY = {
  received: { icon: '↓', label: '收到来信' },
  checked: { icon: '◌', label: '查看邮箱' },
  read: { icon: '○', label: '阅读邮件' },
  sent: { icon: '↗', label: '寄出邮件' },
  replied: { icon: '↩', label: '回复邮件' },
  decision: { icon: '◇', label: '处理决定' },
  webhook_registered: { icon: '⌁', label: '接通实时收信' },
  configuration_test: { icon: '✓', label: '连接测试' },
};

const STATUS_COPY = {
  pending: '进行中',
  succeeded: '已完成',
  skipped: '未处理',
  failed: '失败',
};

function displayTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function actorName(actor) {
  if (actor === 'luze') return '陆泽';
  if (actor === 'user') return '叶檀';
  return '邮箱系统';
}

export function AgentMailRoom({ apiFetch, backend, theme, onOpenSettings }) {
  const [config, setConfig] = useState(null);
  const [activity, setActivity] = useState([]);
  const [state, setState] = useState('loading');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadActivity = useCallback(async () => {
    const response = await apiFetch(`${backend}/agentmail/activity?limit=120`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '知情记录没有读取成功');
    setActivity(Array.isArray(data.activity) ? data.activity : []);
  }, [apiFetch, backend]);

  const sync = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setSyncing(true);
    setError('');
    try {
      const response = await apiFetch(`${backend}/agentmail/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 40 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '邮箱刷新失败');
      await loadActivity();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }, [apiFetch, backend, loadActivity]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState('loading');
      try {
        const response = await apiFetch(`${backend}/agentmail/config`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '邮箱状态没有读取成功');
        if (cancelled) return;
        setConfig(data);
        if (data.configured) {
          await sync({ quiet: true });
        } else {
          await loadActivity().catch(() => {});
        }
        if (!cancelled) setState('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setState('ready');
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [apiFetch, backend, loadActivity, sync]);

  const filteredActivity = useMemo(() => {
    if (filter === 'inbound') return activity.filter(item => item.direction === 'inbound');
    if (filter === 'outbound') return activity.filter(item => item.direction === 'outbound');
    if (filter === 'decision') return activity.filter(item => item.action === 'decision');
    return activity;
  }, [activity, filter]);

  if (state === 'loading') {
    return <div className="agentmail-room-state">正在打开陆泽邮箱…</div>;
  }

  if (!config?.configured) {
    return (
      <div className="agentmail-room-state agentmail-room-state--empty">
        <span className="agentmail-empty-envelope" aria-hidden="true">✉</span>
        <strong>邮箱还没有接进 OurHome</strong>
        <p>连接后，陆泽可以自己收、读、回、寄；每一次动作都会在这里完整留下来。</p>
        <button type="button" onClick={onOpenSettings}>去设置里连接</button>
      </div>
    );
  }

  return (
    <main
      className="agentmail-room"
      style={{
        '--mail-ink': theme.text,
        '--mail-muted': theme.muted,
        '--mail-muted-light': theme.mutedLight,
        '--mail-paper': theme.white,
        '--mail-surface': theme.surface,
        '--mail-cream': theme.cream,
        '--mail-border': theme.border,
        '--mail-border-light': theme.borderLight,
        '--mail-honey': theme.honey,
        '--mail-honey-deep': theme.honeyDeep,
        '--mail-honey-light': theme.honeyLight,
        '--mail-blush': theme.blush,
        '--mail-blush-deep': theme.blushDeep,
      }}
    >
      <section className="agentmail-summary">
        <div className="agentmail-summary-mark" aria-hidden="true">✉</div>
        <div>
          <span>LU ZE&apos;S MAILBOX</span>
          <strong>{config.email || config.inbox_id}</strong>
          <p>{config.enabled ? '自主收发已开启' : '邮箱已暂停'} · 每一次往来都向叶檀公开</p>
        </div>
        <button type="button" onClick={() => sync()} disabled={syncing} aria-label="刷新陆泽邮箱">
          {syncing ? '…' : '↻'}
        </button>
      </section>

      <div className="agentmail-disclosure">
        <span aria-hidden="true">♡</span>
        <p><strong>知情权一直有效</strong>　这里会留下收件人、主题、完整正文、参考过的公开近况、隐私审查与处理结果。</p>
      </div>

      <nav className="agentmail-filters" aria-label="筛选邮箱知情记录">
        {[
          ['all', '全部'],
          ['inbound', '收信'],
          ['outbound', '寄信'],
          ['decision', '决定'],
        ].map(([key, label]) => (
          <button type="button" key={key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </nav>

      {error && <div className="agentmail-error" role="alert">{error}</div>}

      <section className="agentmail-activity" aria-live="polite">
        {filteredActivity.length === 0 && (
          <div className="agentmail-no-activity">
            <span aria-hidden="true">✉</span>
            <p>这里还没有记录。刷新一次邮箱，新来信就会安静地落在这里。</p>
          </div>
        )}
        {filteredActivity.map(item => {
          const copy = ACTION_COPY[item.action] || { icon: '·', label: item.action };
          const expanded = expandedId === item.id;
          const recipients = Array.isArray(item.recipients) ? item.recipients.filter(Boolean) : [];
          return (
            <article key={item.id} className={`agentmail-event agentmail-event--${item.status || 'succeeded'}`}>
              <button
                type="button"
                className="agentmail-event-head"
                onClick={() => setExpandedId(expanded ? null : item.id)}
                aria-expanded={expanded}
              >
                <i aria-hidden="true">{copy.icon}</i>
                <span>
                  <small>{actorName(item.actor)} · {displayTime(item.created_at)}</small>
                  <strong>{copy.label}</strong>
                  <em>{item.subject || item.reason || '没有主题'}</em>
                </span>
                <b>{STATUS_COPY[item.status] || item.status}</b>
                <u aria-hidden="true">{expanded ? '⌃' : '⌄'}</u>
              </button>
              {expanded && (
                <div className="agentmail-event-detail">
                  {item.sender && <p><span>发件人</span>{item.sender}</p>}
                  {recipients.length > 0 && <p><span>收件人</span>{recipients.join('、')}</p>}
                  {item.message_id && <p><span>邮件编号</span><code>{item.message_id}</code></p>}
                  {item.reason && <p><span>处理说明</span>{item.reason}</p>}
                  {item.metadata?.context_used && <p><span>参考近况</span>{item.metadata.context_used}</p>}
                  {item.metadata?.privacy_review && (
                    <p>
                      <span>隐私审查</span>
                      {item.metadata.privacy_review.allowed ? '已通过' : '已拦截'}
                      {item.metadata.privacy_review.reason ? ` · ${item.metadata.privacy_review.reason}` : ''}
                    </p>
                  )}
                  {item.body_text && (
                    <div className="agentmail-body">
                      <span>邮件正文</span>
                      <pre>{item.body_text}</pre>
                    </div>
                  )}
                  {item.error && <p className="agentmail-event-error"><span>失败原因</span>{item.error}</p>}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
