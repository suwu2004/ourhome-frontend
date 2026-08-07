import { useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('zh-CN') : '—';
}

function clock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\//g, '-');
}

function sourceLabel(value) {
  const source = String(value || '');
  if (source === '/chat') return 'Chat';
  if (source === '/chat/regenerate') return 'Chat · 重新生成';
  if (/edit-and-regenerate/.test(source)) return 'Chat · 编辑重发';
  if (/theater/.test(source)) return '小剧场';
  if (/calendar/.test(source)) return '心情日历';
  if (/letters/.test(source)) return '信件 / 日记';
  if (/toybox/.test(source)) return '玩具熊';
  if (/automation/.test(source)) return '自动任务';
  if (source === 'background') return '后台任务';
  return source || 'OurHome';
}

export default function ApiUsageLogPanel() {
  const { theme: C } = useTheme();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ calls: 0, failed: 0, input_tokens: 0, output_tokens: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/api-usage/logs?hours=24&limit=160`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '调用记录没有读出来');
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setSummary(data.summary || { calls: 0, failed: 0, input_tokens: 0, output_tokens: 0 });
    } catch (err) {
      setError(err.message || '调用记录没有读出来');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const requestCounts = useMemo(() => {
    const counts = new Map();
    logs.forEach(row => counts.set(row.request_id, (counts.get(row.request_id) || 0) + 1));
    return counts;
  }, [logs]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', right: 16, bottom: 'max(18px, env(safe-area-inset-bottom))', zIndex: 10020,
          border: `1px solid ${C.honeyMid}`, background: C.white, color: C.honeyDeep,
          borderRadius: 999, padding: '9px 13px', fontFamily: 'inherit', fontSize: 11.5,
          boxShadow: `0 8px 24px ${C.borderLight}`, cursor: 'pointer',
        }}
      >
        API 调用记录
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(41,27,16,.20)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setOpen(false)}>
          <section
            onClick={event => event.stopPropagation()}
            style={{
              width: 'min(520px, 100vw)', height: '100dvh', boxSizing: 'border-box', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', background: C.cream, color: C.text,
              borderLeft: `1px solid ${C.border}`, boxShadow: '-12px 0 36px rgba(60,38,17,.10)',
              fontFamily: 'inherit',
            }}
          >
            <header style={{ padding: 'max(14px, env(safe-area-inset-top)) 16px 12px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 15 }}>API 调用记录</strong>
                  <small style={{ display: 'block', marginTop: 3, color: C.muted, fontSize: 9.5 }}>最近 24 小时 · 调用开始时间精确到秒 · 不保存聊天正文和密钥</small>
                </div>
                <button type="button" onClick={load} disabled={loading} style={{ border: 0, background: 'transparent', color: C.honeyDeep, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}>↻</button>
                <button type="button" onClick={() => setOpen(false)} style={{ border: 0, background: 'transparent', color: C.text, fontSize: 20, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6, marginTop: 11 }}>
                {[
                  ['调用', summary.calls],
                  ['失败', summary.failed],
                  ['输入', summary.input_tokens],
                  ['输出', summary.output_tokens],
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '7px 5px', textAlign: 'center', borderRadius: 10, border: `1px solid ${C.borderLight}`, background: C.cream }}>
                    <small style={{ display: 'block', color: C.muted, fontSize: 8.5 }}>{label}</small>
                    <b style={{ display: 'block', marginTop: 2, fontSize: 10.5 }}>{number(value)}</b>
                  </div>
                ))}
              </div>
            </header>

            <main style={{ flex: 1, overflowY: 'auto', padding: '10px 12px calc(20px + env(safe-area-inset-bottom))' }}>
              {loading && logs.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 11 }}>正在翻调用账本…</div>}
              {error && <div style={{ padding: 11, borderRadius: 12, border: `1px solid ${C.blushDeep}`, color: C.blushDeep, background: C.white, fontSize: 10.5, lineHeight: 1.5 }}>{error}</div>}
              {!loading && !error && logs.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 11 }}>还没有调用记录。后端部署新版后，新调用会从这里开始记。</div>}

              <div style={{ display: 'grid', gap: 7 }}>
                {logs.map(row => {
                  const repeated = (requestCounts.get(row.request_id) || 0) > 1;
                  const failed = row.status === 'error';
                  return (
                    <article key={row.id} style={{ padding: '10px 11px', borderRadius: 13, border: `1px solid ${failed ? C.blushDeep : C.borderLight}`, background: C.white }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b style={{ fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}>{clock(row.started_at || row.created_at)}</b>
                        <span style={{ marginLeft: 'auto', color: failed ? C.blushDeep : C.honeyDeep, fontSize: 9.5 }}>{failed ? `失败 · HTTP ${row.http_status || '—'}` : `HTTP ${row.http_status || 200}`}</span>
                      </div>
                      <div style={{ marginTop: 5, fontSize: 11.5, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                        <strong>{row.api_profile_name || row.api_origin || '当前 API 站点'}</strong>
                        <span style={{ color: C.muted }}> · {row.model}</span>
                      </div>
                      <div style={{ marginTop: 5, color: C.muted, fontSize: 9.5, display: 'flex', flexWrap: 'wrap', gap: '3px 10px' }}>
                        <span>{sourceLabel(row.source)}</span>
                        <span>输入 {number(row.input_tokens)}</span>
                        <span>输出 {number(row.output_tokens)}</span>
                        <span>{Number.isFinite(Number(row.duration_ms)) ? `${(Number(row.duration_ms) / 1000).toFixed(1)}s` : '—'}</span>
                      </div>
                      {repeated && <div style={{ marginTop: 6, color: C.honeyDeep, fontSize: 9.5 }}>同一个 OurHome 请求里的第 {row.call_index} 次模型调用</div>}
                      {row.error_detail && <div style={{ marginTop: 6, color: C.blushDeep, fontSize: 9, lineHeight: 1.45, wordBreak: 'break-word' }}>{row.error_detail}</div>}
                      <div style={{ marginTop: 5, color: C.mutedLight, fontSize: 8, wordBreak: 'break-all' }}>request {String(row.request_id || '').slice(0, 18)}…</div>
                    </article>
                  );
                })}
              </div>
            </main>
          </section>
        </div>
      )}
    </>
  );
}
