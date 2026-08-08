import { createPortal } from 'react-dom';
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

function purposeLabel(value) {
  const purpose = String(value || '').trim();
  if (purpose === 'context-ledger') return '隐藏账本整理';
  if (purpose === 'memory-journal') return '记忆整理';
  if (purpose === 'visible-thinking') return '可见思考补全';
  if (purpose === 'theater') return '小剧场';
  return '';
}

export default function ApiUsageLogPanel() {
  const { theme: C } = useTheme();
  const [open, setOpen] = useState(false);
  const [controllerTarget, setControllerTarget] = useState(null);
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

  useEffect(() => {
    let frame = 0;
    const findTarget = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const sections = Array.from(document.querySelectorAll('body[data-ourhome-room="settings"] .ourhome-scroll > section'));
        const next = sections.find(section => String(section.textContent || '').includes('家里的控制台')) || null;
        setControllerTarget(current => current === next ? current : next);
      });
    };
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    findTarget();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  const requestCounts = useMemo(() => {
    const counts = new Map();
    logs.forEach(row => counts.set(row.request_id, (counts.get(row.request_id) || 0) + 1));
    return counts;
  }, [logs]);

  const controllerButton = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      style={{
        width: '100%', marginTop: 10, padding: '10px 11px', display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 18px',
        alignItems: 'center', gap: 9, textAlign: 'left', border: `1px solid ${C.borderLight}`, borderRadius: 13,
        background: C.cream, color: C.text, fontFamily: 'inherit', cursor: 'pointer', boxSizing: 'border-box',
      }}
    >
      <span style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 10, background: C.honeyLight, color: C.honeyDeep, fontSize: 15 }}>↗</span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 11.5 }}>API 调用记录</b>
        <small style={{ display: 'block', marginTop: 2, color: C.muted, fontSize: 9.5 }}>上游请求时间、模型、token 与调用用途</small>
      </span>
      <span style={{ color: C.honeyDeep, fontSize: 17 }}>›</span>
    </button>
  );

  return (
    <>
      {controllerTarget && createPortal(controllerButton, controllerTarget)}

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
            <header style={{ padding: 'max(9px, env(safe-area-inset-top)) 14px 10px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ minHeight: 52, display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 40px', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => setOpen(false)} aria-label="返回设置" style={{ width: 36, height: 36, justifySelf: 'start', border: 0, borderRadius: 12, background: C.cream, color: C.honeyDeep, fontSize: 19, cursor: 'pointer', fontFamily: 'inherit' }}>←</button>
                <div style={{ minWidth: 0, textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: 15.5, letterSpacing: '.05em' }}>API 调用记录</strong>
                  <small style={{ display: 'block', marginTop: 3, color: C.muted, fontSize: 8.5, letterSpacing: '.10em' }}>API USAGE LOG · 最近 24 小时</small>
                </div>
                <button type="button" onClick={load} disabled={loading} aria-label="刷新调用记录" style={{ width: 36, height: 36, justifySelf: 'end', border: 0, borderRadius: 12, background: 'transparent', color: C.honeyDeep, fontSize: 20, cursor: loading ? 'default' : 'pointer', opacity: loading ? .45 : 1, fontFamily: 'Arial, sans-serif' }}>↻</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6, marginTop: 8 }}>
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
              <div style={{ marginTop: 7, textAlign: 'center', color: C.mutedLight, fontSize: 8.5 }}>真正发出上游请求的时间 · 不保存聊天正文和密钥</div>
            </header>

            <main style={{ flex: 1, overflowY: 'auto', padding: '10px 12px calc(20px + env(safe-area-inset-bottom))' }}>
              {loading && logs.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 11 }}>正在翻调用账本…</div>}
              {error && <div style={{ padding: 11, borderRadius: 12, border: `1px solid ${C.blushDeep}`, color: C.blushDeep, background: C.white, fontSize: 10.5, lineHeight: 1.5 }}>{error}</div>}
              {!loading && !error && logs.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 11 }}>还没有调用记录。新调用会从这里开始记。</div>}

              <div style={{ display: 'grid', gap: 7 }}>
                {logs.map(row => {
                  const repeated = (requestCounts.get(row.request_id) || 0) > 1;
                  const failed = row.status === 'error';
                  const purpose = purposeLabel(row.purpose);
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
                        <span>输入 {number(row.input_tokens)} token</span>
                        <span>输出 {number(row.output_tokens)} token</span>
                        <span>{Number.isFinite(Number(row.duration_ms)) ? `${(Number(row.duration_ms) / 1000).toFixed(1)}s` : '—'}</span>
                      </div>
                      {purpose && <div style={{ marginTop: 6, display: 'inline-block', padding: '2px 7px', borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, fontSize: 9 }}>{purpose}</div>}
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
