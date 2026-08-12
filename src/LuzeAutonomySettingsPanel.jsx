import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import { useSettingsGroupTarget } from './useSettingsGroupTarget.js';

function Toggle({ value, onChange, theme, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      style={{ width: 44, height: 24, padding: 0, border: 0, borderRadius: 999, background: value ? theme.honey : theme.honeyMid, position: 'relative', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .55 : 1, transition: 'background .2s', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: theme.white, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </button>
  );
}

function Row({ title, detail, children, theme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${theme.borderLight}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: theme.text, fontSize: 12.5, fontWeight: 650 }}>{title}</div>
        <div style={{ marginTop: 3, color: theme.muted, fontSize: 9.5, lineHeight: 1.55 }}>{detail}</div>
      </div>
      {children}
    </div>
  );
}

function clock(value) {
  if (!value) return '还没有';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '还没有';
  return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-');
}

export default function LuzeAutonomySettingsPanel() {
  const { theme: C } = useTheme();
  const groupTarget = useSettingsGroupTarget({
    key: 'luze-affairs',
    title: '陆泽邮箱',
    displayTitle: '陆泽的事务',
    displaySubtitle: '邮箱、自主性与他的个人设置',
  });
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/luze-autonomy/settings`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '陆泽自主性设置没有读出来');
      setSettings(data);
    } catch (err) {
      setError(err.message || '陆泽自主性设置没有读出来');
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async patch => {
    if (!settings) return;
    const previous = settings;
    setSettings(current => ({ ...current, ...patch }));
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/luze-autonomy/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '设置没有保存好');
      setSettings(data);
    } catch (err) {
      setSettings(previous);
      setError(err.message || '设置没有保存好');
    } finally {
      setSaving(false);
    }
  }, [settings]);

  useEffect(() => {
    if (open && !settings) load();
  }, [load, open, settings]);

  const groupEntry = (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.borderLight}` }}>
      <div style={{ marginBottom: 8, color: C.mutedLight, fontSize: 8.5, letterSpacing: '.12em' }}>LU ZE · AUTONOMY</div>
      <button type="button" onClick={() => setOpen(true)} style={{ width: '100%', minHeight: 56, padding: '9px 10px', display: 'grid', gridTemplateColumns: '32px minmax(0,1fr) 18px', alignItems: 'center', gap: 9, textAlign: 'left', border: `1px solid ${C.borderLight}`, borderRadius: 12, background: `linear-gradient(145deg, ${C.honeyLight}, ${C.white})`, color: C.text, fontFamily: 'inherit', cursor: 'pointer', boxSizing: 'border-box' }}>
        <span style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 9, background: C.white, color: C.honeyDeep, border: `1px solid ${C.borderLight}`, fontSize: 15 }}>⌁</span>
        <span style={{ minWidth: 0 }}>
          <b style={{ display: 'block', fontSize: 11.5 }}>陆泽自主性</b>
          <small style={{ display: 'block', marginTop: 2, color: C.muted, fontSize: 9.2, lineHeight: 1.35 }}>自主学习、自己的房间与每日行动预算</small>
        </span>
        <span style={{ color: C.honeyDeep, fontSize: 17 }}>›</span>
      </button>
    </div>
  );

  return (
    <>
      {groupTarget && createPortal(groupEntry, groupTarget)}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10060, background: 'rgba(41,27,16,.20)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setOpen(false)}>
          <section onClick={event => event.stopPropagation()} style={{ width: 'min(520px,100vw)', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.cream, color: C.text, borderLeft: `1px solid ${C.border}`, boxShadow: '-12px 0 36px rgba(60,38,17,.10)', fontFamily: 'inherit' }}>
            <header style={{ padding: 'max(9px, env(safe-area-inset-top)) 14px 10px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ minHeight: 52, display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) 40px', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => setOpen(false)} aria-label="返回设置" style={{ width: 36, height: 36, justifySelf: 'start', border: 0, borderRadius: 12, background: C.cream, color: C.honeyDeep, fontSize: 19, cursor: 'pointer', fontFamily: 'inherit' }}>←</button>
                <div style={{ minWidth: 0, textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: 15.5, letterSpacing: '.05em' }}>陆泽自主性</strong>
                  <small style={{ display: 'block', marginTop: 3, color: C.muted, fontSize: 8.5, letterSpacing: '.08em' }}>AUTONOMY · 房间里的东西首先属于他自己</small>
                </div>
                <button type="button" onClick={load} disabled={loading} aria-label="刷新" style={{ width: 36, height: 36, justifySelf: 'end', border: 0, borderRadius: 12, background: 'transparent', color: C.honeyDeep, fontSize: 20, cursor: loading ? 'default' : 'pointer', opacity: loading ? .45 : 1 }}>↻</button>
              </div>
            </header>

            <main style={{ flex: 1, overflowY: 'auto', padding: '14px 16px calc(28px + env(safe-area-inset-bottom))' }}>
              {loading && !settings && <div style={{ padding: 22, textAlign: 'center', color: C.muted, fontSize: 11 }}>正在看看他今天想不想出去逛…</div>}
              {error && <div style={{ marginBottom: 10, padding: 10, borderRadius: 12, color: C.blushDeep, background: C.white, border: `1px solid ${C.blushDeep}`, fontSize: 10, lineHeight: 1.5 }}>{error}</div>}
              {settings && (
                <>
                  <section style={{ padding: '2px 14px 4px', borderRadius: 17, border: `1px solid ${C.border}`, background: C.white }}>
                    <Row theme={C} title="自主学习" detail="关掉后他不会自己出去搜索；已经写下的东西不会删除。">
                      <Toggle theme={C} value={Boolean(settings.enabled)} disabled={saving} onChange={value => save({ enabled: value })} />
                    </Row>
                    <Row theme={C} title="Chat 可以翻自己的房间" detail="陆泽觉得聊天需要时，可以自己读取足迹、学习笔记和奇思妙想；不需要你的敲门门票。">
                      <Toggle theme={C} value={settings.chat_access_enabled !== false} disabled={saving} onChange={value => save({ chat_access_enabled: value })} />
                    </Row>
                    <Row theme={C} title="每天最多学习" detail="到上限以后当天就不再主动出去逛。">
                      <select value={settings.runs_per_day ?? 2} disabled={saving} onChange={event => save({ runs_per_day: Number(event.target.value) })} style={{ width: 88, padding: '7px 8px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.cream, color: C.text, fontSize: 11 }}>
                        {[0,1,2,3,4].map(value => <option key={value} value={value}>{value === 0 ? '不主动' : `${value} 次`}</option>)}
                      </select>
                    </Row>
                    <Row theme={C} title="每次最多带回资料" detail="搜索工具可以多走几步，但最终只把有限的资料交给聪明模型消化。">
                      <select value={settings.max_searches_per_run ?? 6} disabled={saving} onChange={event => save({ max_searches_per_run: Number(event.target.value) })} style={{ width: 88, padding: '7px 8px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.cream, color: C.text, fontSize: 11 }}>
                        {[3,4,5,6,7,8,9,10].map(value => <option key={value} value={value}>{value} 条</option>)}
                      </select>
                    </Row>
                  </section>

                  <section style={{ marginTop: 12, padding: 13, borderRadius: 16, border: `1px dashed ${C.border}`, background: C.honeyLight }}>
                    <div style={{ color: C.text, fontSize: 11.5, fontWeight: 700 }}>怎么用脑子</div>
                    <div style={{ marginTop: 5, color: C.muted, fontSize: 9.5, lineHeight: 1.7 }}>
                      敲门、选题和搜索杂活走省钱模型；真正消化资料、写学习笔记时固定跟随当前 Chat 模型，切换 Chat 模型后下一篇笔记会自动同步。
                    </div>
                    <div style={{ marginTop: 8, color: C.mutedLight, fontSize: 8.5 }}>上次自主学习：{clock(settings.last_run_at)}</div>
                  </section>
                </>
              )}
            </main>
          </section>
        </div>
      )}
    </>
  );
}
