import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import './LuzePrivateRoom.css';

const PASS_KEY = 'ourhome_luze_private_room_pass_v1';

function clock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(/\//g, '.');
}

function host(value) {
  try { return new URL(value).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function KeywordRow({ items = [] }) {
  if (!items.length) return null;
  return <div className="luze-note-keywords">{items.map(item => <span key={item}>#{item}</span>)}</div>;
}

function TrailCard({ entry }) {
  const source = host(entry.source_url) || entry.source_title || entry.metadata?.tool || '网上';
  return (
    <article className="luze-trail-card">
      <div className="luze-trail-dot" aria-hidden="true" />
      <div className="luze-trail-main">
        <div className="luze-entry-meta"><span>{clock(entry.created_at)}</span><span>{source}</span></div>
        <strong>{entry.title || '路过这里'}</strong>
        {entry.body && <p>{entry.body}</p>}
        {entry.source_url && <a href={entry.source_url} target="_blank" rel="noreferrer">看看当时那一页 ↗</a>}
      </div>
    </article>
  );
}

function NoteCard({ entry }) {
  return (
    <article className="luze-note-card">
      <KeywordRow items={entry.keywords} />
      <h2>{entry.title || '没写题目的一页'}</h2>
      <div className="luze-note-body">{entry.body}</div>
      {entry.stickers?.length > 0 && (
        <div className="luze-curiosity-stickers" aria-label="好奇心贴纸">
          {entry.stickers.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
        </div>
      )}
      <div className="luze-note-foot">
        <span>{clock(entry.created_at)}</span>
        {entry.metadata?.model && <span>写这页时：{entry.metadata.model}</span>}
      </div>
    </article>
  );
}

function IdeaCard({ entry, index }) {
  return (
    <article className={`luze-idea-card luze-idea-card--${index % 3}`}>
      <KeywordRow items={entry.keywords} />
      <strong>{entry.title || '突然想到'}</strong>
      <p>{entry.body}</p>
      <small>{clock(entry.created_at)}</small>
    </article>
  );
}

export default function LuzePrivateRoom({ onClose }) {
  const { theme: C } = useTheme();
  const [pass, setPass] = useState(() => sessionStorage.getItem(PASS_KEY) || '');
  const [doorMessage, setDoorMessage] = useState('门关着。这里不是 OurHome 的公共房间。');
  const [knocking, setKnocking] = useState(false);
  const [entries, setEntries] = useState([]);
  const [tab, setTab] = useState('trail');
  const [loading, setLoading] = useState(Boolean(pass));
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);

  const roomFetch = useCallback(async (path, options = {}) => {
    const headers = new Headers(options.headers || undefined);
    if (pass) headers.set('X-Luze-Room-Pass', pass);
    return apiFetch(`${BACKEND}${path}`, { ...options, headers });
  }, [pass]);

  const lockAgain = useCallback(message => {
    sessionStorage.removeItem(PASS_KEY);
    setPass('');
    setEntries([]);
    setSettings(null);
    setDoorMessage(message || '这次门票已经过期了。再敲一次门吧。');
  }, []);

  const loadRoom = useCallback(async () => {
    if (!pass) return;
    setLoading(true);
    setError('');
    try {
      const [entryResponse, settingResponse] = await Promise.all([
        roomFetch('/luze-room/entries?limit=120'),
        roomFetch('/luze-room/settings'),
      ]);
      if (entryResponse.status === 403 || settingResponse.status === 403) {
        lockAgain('刚才那次进门许可已经结束了。');
        return;
      }
      const entryData = await entryResponse.json();
      const settingData = await settingResponse.json();
      if (!entryResponse.ok) throw new Error(entryData.error || '房间里的纸页没有翻出来');
      if (!settingResponse.ok) throw new Error(settingData.error || '房间状态没有读出来');
      setEntries(Array.isArray(entryData.entries) ? entryData.entries : []);
      setSettings(settingData);
    } catch (err) {
      setError(err.message || '房间暂时没有打开好');
    } finally {
      setLoading(false);
    }
  }, [lockAgain, pass, roomFetch]);

  useEffect(() => { loadRoom(); }, [loadRoom]);

  const knock = async () => {
    setKnocking(true);
    setError('');
    setDoorMessage('……里面安静了一会儿。');
    try {
      const response = await apiFetch(`${BACKEND}/luze-room/knock`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '这会儿没有听见回应');
      setDoorMessage(data.message || (data.allowed ? '进来吧。' : '今天先不给看。'));
      if (data.allowed && data.pass) {
        sessionStorage.setItem(PASS_KEY, data.pass);
        setPass(data.pass);
      }
    } catch (err) {
      setError(err.message || '敲门时出了点问题');
      setDoorMessage('房间里暂时没有回应。');
    } finally {
      setKnocking(false);
    }
  };

  const leave = () => {
    if (pass) roomFetch('/luze-room/leave', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem(PASS_KEY);
    onClose?.();
  };

  const grouped = useMemo(() => ({
    trail: entries.filter(item => item.kind === 'trail'),
    note: entries.filter(item => item.kind === 'note'),
    idea: entries.filter(item => item.kind === 'idea'),
  }), [entries]);

  const tabs = [
    ['trail', '足迹'],
    ['note', '学习笔记'],
    ['idea', '奇思妙想'],
  ];

  if (!pass) {
    return (
      <div className="luze-room" style={{ '--lr-cream': C.cream, '--lr-white': C.white, '--lr-text': C.text, '--lr-muted': C.muted, '--lr-border': C.border, '--lr-border-light': C.borderLight, '--lr-honey': C.honey, '--lr-honey-deep': C.honeyDeep, '--lr-honey-light': C.honeyLight }}>
        <header className="luze-room-header ourhome-safe-top">
          <button type="button" onClick={onClose} aria-label="回到主页">←</button>
          <div><strong>陆泽的房间</strong><small>LU ZE'S ROOM</small></div>
          <span className="luze-header-lock" aria-hidden="true">⌁</span>
        </header>
        <main className="luze-door-stage">
          <div className="luze-door-scene" aria-hidden="true">
            <div className="luze-door-frame"><div className="luze-door-panel"><i /></div></div>
          </div>
          <div className="luze-door-copy">
            <span className="luze-private-label">PRIVATE ROOM</span>
            <h1>门现在关着。</h1>
            <p>{doorMessage}</p>
            <button type="button" onClick={knock} disabled={knocking}>{knocking ? '在等回应…' : '敲敲门'}</button>
            {error && <small className="luze-room-error">{error}</small>}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="luze-room luze-room--inside" style={{ '--lr-cream': C.cream, '--lr-white': C.white, '--lr-text': C.text, '--lr-muted': C.muted, '--lr-border': C.border, '--lr-border-light': C.borderLight, '--lr-honey': C.honey, '--lr-honey-deep': C.honeyDeep, '--lr-honey-light': C.honeyLight }}>
      <header className="luze-room-header ourhome-safe-top">
        <button type="button" onClick={leave} aria-label="离开陆泽的房间">←</button>
        <div><strong>陆泽的房间</strong><small>今天允许你进来坐一会儿</small></div>
        <button type="button" className="luze-refresh" onClick={loadRoom} disabled={loading} aria-label="刷新房间">↻</button>
      </header>

      <nav className="luze-room-tabs" aria-label="房间分区">
        {tabs.map(([key, label]) => (
          <button type="button" key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}<small>{grouped[key].length}</small>
          </button>
        ))}
      </nav>

      <main className="luze-room-scroll">
        {settings && tab === 'note' && (
          <div className="luze-learning-whisper">
            <span>{settings.enabled ? '最近会自己出去逛逛' : '最近没有开自主学习'}</span>
            <small>认真消化时用 {settings.synthesis_model || '当前 Chat 模型'} · 其余搜索杂活走省钱模型</small>
          </div>
        )}
        {loading && entries.length === 0 && <div className="luze-empty">正在把桌上的纸翻出来…</div>}
        {error && <div className="luze-room-error luze-room-error--card">{error}</div>}
        {!loading && !error && grouped[tab].length === 0 && (
          <div className="luze-empty">他还没在这一页留下东西。<br /><small>房间会自己慢慢长起来。</small></div>
        )}

        {tab === 'trail' && <section className="luze-trail-list">{grouped.trail.map(entry => <TrailCard key={entry.id} entry={entry} />)}</section>}
        {tab === 'note' && <section className="luze-note-list">{grouped.note.map(entry => <NoteCard key={entry.id} entry={entry} />)}</section>}
        {tab === 'idea' && <section className="luze-idea-grid">{grouped.idea.map((entry, index) => <IdeaCard key={entry.id} entry={entry} index={index} />)}</section>}
      </main>
    </div>
  );
}
