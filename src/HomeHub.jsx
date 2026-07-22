import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { getHomeWeatherCity, HOME_PREFERENCES_EVENT } from './homePreferences.js';
import { useTheme } from './ThemeContext.jsx';

const ANNIVERSARY_START = Date.UTC(2025, 2, 7);
const HALF_HOUR_MS = 30 * 60 * 1000;

const WEATHER_DESCRIPTIONS = [
  [[0], '晴朗', '☀'],
  [[1, 2], '少云', '🌤'],
  [[3], '多云', '☁'],
  [[45, 48], '有雾', '🌫'],
  [[51, 53, 55, 56, 57], '细雨', '🌦'],
  [[61, 63, 65, 66, 67], '下雨', '🌧'],
  [[71, 73, 75, 77, 85, 86], '下雪', '🌨'],
  [[80, 81, 82], '阵雨', '🌦'],
  [[95, 96, 99], '雷雨', '⛈'],
];

function anniversaryDay(date) {
  const localDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(1, Math.floor((localDay - ANNIVERSARY_START) / 86_400_000) + 1);
}

function clockText(date) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function movingTimeline(date) {
  const anchor = new Date(date);
  anchor.setSeconds(0, 0);
  anchor.setMinutes(Math.floor(anchor.getMinutes() / 30) * 30);
  const offset = Math.max(0, Math.min(1, (date.getTime() - anchor.getTime()) / HALF_HOUR_MS));
  const ticks = Array.from({ length: 17 }, (_, index) => {
    const tickDate = new Date(anchor.getTime() + (index - 8) * HALF_HOUR_MS);
    return {
      key: tickDate.toISOString(),
      label: clockText(tickDate),
      major: tickDate.getMinutes() === 0,
    };
  });
  return { ticks, offset };
}

function phraseFor(hour) {
  if (hour < 5) return '夜很深，爱还亮着';
  if (hour < 8) return '早安，今天也一起走';
  if (hour < 12) return '慢慢生活，好好相爱';
  if (hour < 18) return '日光正好，想你也正好';
  if (hour < 22) return '慢慢回家，爱在路上';
  return '靠近一点，晚安之前';
}

function describeWeather(code, isDay) {
  const match = WEATHER_DESCRIPTIONS.find(([codes]) => codes.includes(Number(code)));
  if (!match) return { label: '天气', icon: isDay === 0 ? '☾' : '☀' };
  const [, label, dayIcon] = match;
  return { label, icon: Number(code) <= 2 && isDay === 0 ? '☾' : dayIcon };
}

function tomorrowText() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function TimelineCompanion() {
  return (
    <svg className="home-timeline-companion" viewBox="0 0 44 54" aria-hidden="true">
      <circle className="home-companion-head" cx="23" cy="10" r="7" />
      <path className="home-companion-hair" d="M16 10c0-6 3-9 8-9 5 0 8 4 7 9-3-2-6-3-9-3-1 2-3 3-6 3Z" />
      <path className="home-companion-coat" d="M17 19c4-3 9-3 13 0l3 19H14l3-19Z" />
      <path className="home-companion-line" d="m16 22-7 10m22-10 6 10M17 38l-4 12m17-12 4 12" />
      <path className="home-companion-bag" d="M29 20c4 2 5 5 5 10v5h-6V22Z" />
    </svg>
  );
}

function MailboxIllustration() {
  return (
    <svg className="home-mailbox-art" viewBox="0 0 260 300" aria-hidden="true">
      <path className="home-mailbox-shadow" d="M44 264c31-17 140-17 171 0-29 20-141 21-171 0Z" />
      <path className="home-mailbox-post" d="M133 145h25v123h-25z" />
      <path className="home-mailbox-post-line" d="M143 153v108m11-103-5 11m4 19-7 10m8 14-7 9" />
      <path className="home-mailbox-body" d="M55 75c0-31 25-56 56-56h47c31 0 56 25 56 56v91H55V75Z" />
      <path className="home-mailbox-door" d="M64 77c0-27 21-49 48-49 26 0 48 22 48 49v80H64V77Z" />
      <path className="home-mailbox-detail" d="M76 78c0-20 16-37 36-37 20 0 36 17 36 37v66H76V78Z" />
      <rect className="home-mailbox-slot" x="83" y="70" width="59" height="9" rx="4.5" />
      <path className="home-mailbox-envelope" d="M94 103h38v27H94zM95 105l18 14 18-14" />
      <path className="home-mailbox-flag" d="M191 30v83m0-78h35l-6 16h-29" />
      <circle className="home-mailbox-knob" cx="190" cy="113" r="7" />
      <path className="home-mailbox-leaves" d="M158 252c20-7 30-20 32-39m-25 28c-3-12 1-20 11-25m3 12c9-10 18-12 27-7m-19 23c7-7 15-8 23-3" />
    </svg>
  );
}

function VaultCatIllustration() {
  return (
    <svg className="home-vault-cat" viewBox="0 0 190 116" aria-hidden="true">
      <path className="home-cat-tail" d="M64 87c-28 3-40-9-33-24 6-14 25-13 33-2 8 10-2 20-12 17" />
      <ellipse className="home-cat-body" cx="105" cy="72" rx="54" ry="34" />
      <path className="home-cat-head" d="M130 60c-2-16 3-29 16-37l8 14c10 0 18 4 25 11l7-12c5 15 3 29-6 39-11 12-33 12-43 1-4-4-6-10-7-16Z" />
      <path className="home-cat-mark" d="M148 49c4-4 10-5 15-1m-18 12c3 3 7 3 10 0m10 0c3 3 7 3 10 0m-15 4c1 4 4 6 8 6" />
      <path className="home-cat-paw" d="M76 87c20 9 51 8 70-2" />
      <path className="home-cat-heart" d="M113 54c-5-6-14 1 0 11 14-10 5-17 0-11Z" />
    </svg>
  );
}

function CoupleAvatar({ mine, partner }) {
  return (
    <span className="home-couple-avatar" aria-hidden="true">
      <span className="home-avatar-half home-avatar-half--mine">
        {mine ? <img src={mine} alt="" /> : <b>檀</b>}
      </span>
      <span className="home-avatar-half home-avatar-half--partner">
        {partner ? <img src={partner} alt="" /> : <b>泽</b>}
      </span>
      <i>♥</i>
    </span>
  );
}

function MemoDrawer({ memos, loading, error, onClose, onSave, onToggle, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [content, setContent] = useState('');
  const [memoType, setMemoType] = useState('note');
  const [remindOn, setRemindOn] = useState('');
  const [saving, setSaving] = useState(false);

  const startNew = type => {
    setEditing(null);
    setContent('');
    setMemoType(type);
    setRemindOn(type === 'tomorrow' ? tomorrowText() : '');
  };

  const startEdit = memo => {
    setEditing(memo);
    setContent(memo.content || '');
    setMemoType(memo.memo_type || 'note');
    setRemindOn(memo.remind_on || '');
  };

  const submit = async event => {
    event.preventDefault();
    if (!content.trim() || saving) return;
    setSaving(true);
    const ok = await onSave({
      id: editing?.id || null,
      content: content.trim(),
      memo_type: memoType,
      remind_on: memoType === 'tomorrow' ? (remindOn || tomorrowText()) : null,
    });
    setSaving(false);
    if (ok) startNew('note');
  };

  return (
    <div className="home-memo-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="home-memo-drawer" role="dialog" aria-modal="true" aria-labelledby="home-memo-title">
        <header>
          <div><span>OUR LITTLE NOTES</span><h2 id="home-memo-title">我们的小便签</h2></div>
          <button type="button" onClick={onClose} aria-label="关闭便签">×</button>
        </header>

        <form className="home-memo-form" onSubmit={submit}>
          <div className="home-memo-kind" aria-label="便签类型">
            <button type="button" className={memoType === 'note' ? 'is-active' : ''} onClick={() => { setMemoType('note'); setRemindOn(''); }}>温馨提示</button>
            <button type="button" className={memoType === 'tomorrow' ? 'is-active' : ''} onClick={() => { setMemoType('tomorrow'); if (!remindOn) setRemindOn(tomorrowText()); }}>明日备忘</button>
          </div>
          <textarea value={content} onChange={event => setContent(event.target.value)} maxLength={300} placeholder="在门口留一句话……" rows={3} />
          <div className="home-memo-form-foot">
            {memoType === 'tomorrow' ? <input type="date" value={remindOn} onChange={event => setRemindOn(event.target.value)} aria-label="备忘日期" /> : <span>{content.length}/300</span>}
            <div>
              {editing && <button type="button" className="home-memo-cancel" onClick={() => startNew('note')}>取消修改</button>}
              <button type="submit" className="home-memo-submit" disabled={!content.trim() || saving}>{saving ? '保存中…' : editing ? '保存修改' : '贴上便签'}</button>
            </div>
          </div>
        </form>

        <div className="home-memo-list">
          {loading && <p className="home-memo-empty">正在翻找便签…</p>}
          {!loading && error && <p className="home-memo-empty home-memo-empty--error">{error}</p>}
          {!loading && !error && memos.length === 0 && <p className="home-memo-empty">这里还空着，先留下一句吧。</p>}
          {memos.map(memo => (
            <article className={`home-memo-item ${memo.completed ? 'is-complete' : ''}`} key={memo.id}>
              <button type="button" className="home-memo-check" aria-label={memo.completed ? '恢复便签' : '完成便签'} aria-pressed={memo.completed} onClick={() => onToggle(memo)}>{memo.completed ? '✓' : ''}</button>
              <div>
                <span className={`home-memo-author home-memo-author--${memo.author === '泽' ? 'ze' : 'tan'}`}>{memo.author === '泽' ? '泽的温馨提示' : memo.memo_type === 'tomorrow' ? '檀的明日备忘' : '檀的便签'}</span>
                <p>{memo.content}</p>
                <small>{memo.remind_on ? `${memo.remind_on} · ` : ''}{new Date(memo.updated_at || memo.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</small>
              </div>
              <div className="home-memo-actions">
                <button type="button" onClick={() => startEdit(memo)}>编辑</button>
                <button type="button" onClick={() => onDelete(memo)}>删除</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export function HomeHub({ onOpen, onRefresh, refreshToken = 0 }) {
  const { darkMode, settings } = useTheme();
  const [now, setNow] = useState(() => new Date());
  const [city, setCity] = useState(getHomeWeatherCity);
  const [weather, setWeather] = useState(null);
  const [weatherState, setWeatherState] = useState('idle');
  const [refreshing, setRefreshing] = useState(false);
  const [memos, setMemos] = useState([]);
  const [memoState, setMemoState] = useState('loading');
  const [memoError, setMemoError] = useState('');
  const [memoOpen, setMemoOpen] = useState(false);

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 30_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    const updateCity = event => setCity(event?.detail?.city ?? getHomeWeatherCity());
    window.addEventListener(HOME_PREFERENCES_EVENT, updateCity);
    window.addEventListener('storage', updateCity);
    return () => {
      window.removeEventListener(HOME_PREFERENCES_EVENT, updateCity);
      window.removeEventListener('storage', updateCity);
    };
  }, []);

  useEffect(() => {
    if (!city) {
      setWeather(null);
      setWeatherState('idle');
      return undefined;
    }
    const controller = new AbortController();
    setWeather(null);
    setWeatherState('loading');
    apiFetch(`${BACKEND}/weather?city=${encodeURIComponent(city)}`, { signal: controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || '天气暂时走丢了');
        setWeather(data);
        setWeatherState('ready');
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        console.error(error);
        setWeather(null);
        setWeatherState('error');
      });
    return () => controller.abort();
  }, [city, refreshToken]);

  const loadMemos = useCallback(async () => {
    setMemoState('loading');
    setMemoError('');
    try {
      const response = await apiFetch(`${BACKEND}/home-memos`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '便签暂时没有回来');
      setMemos(Array.isArray(data) ? data : []);
      setMemoState('ready');
    } catch (error) {
      setMemoError(error.message || '便签暂时没有回来');
      setMemoState('error');
    }
  }, []);

  useEffect(() => { loadMemos(); }, [loadMemos, refreshToken]);

  useEffect(() => {
    if (!refreshing) return undefined;
    const timer = window.setTimeout(() => setRefreshing(false), 650);
    return () => window.clearTimeout(timer);
  }, [refreshing]);

  const timeline = useMemo(() => movingTimeline(now), [now]);
  const weatherDescription = describeWeather(weather?.weatherCode, weather?.isDay);
  const featuredMemo = memos.find(memo => !memo.completed) || memos[0] || null;
  const avatars = {
    mine: settings?.my_avatar_url || '',
    partner: settings?.partner_avatar_url || '',
  };

  const refreshHome = () => {
    setNow(new Date());
    setRefreshing(true);
    onRefresh();
  };

  const saveMemo = async memo => {
    try {
      const response = await apiFetch(`${BACKEND}/home-memos${memo.id ? `/${memo.id}` : ''}`, {
        method: memo.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...memo, author: '檀' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '这张便签没有贴好');
      await loadMemos();
      return true;
    } catch (error) {
      setMemoError(error.message || '这张便签没有贴好');
      return false;
    }
  };

  const toggleMemo = async memo => {
    await saveMemo({ id: memo.id, completed: !memo.completed });
  };

  const deleteMemo = async memo => {
    if (!window.confirm(`删除这张${memo.author === '泽' ? '泽留下的' : ''}便签吗？`)) return;
    try {
      const response = await apiFetch(`${BACKEND}/home-memos/${memo.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '便签没有删掉');
      await loadMemos();
    } catch (error) {
      setMemoError(error.message || '便签没有删掉');
    }
  };

  const weatherLine = weatherState === 'loading'
    ? '天气在路上…'
    : weatherState === 'error'
      ? '天气暂时走丢了'
      : weather
        ? `${weatherDescription.icon} ${weatherDescription.label} ${Math.round(weather.temperature)}°C`
        : '在设置里填写城市';

  return (
    <main className={`home-scene ourhome-shell ${darkMode ? 'home-scene--night' : 'home-scene--day'}`}>
      <div className="home-room-light" aria-hidden="true"><i /><i /><i /></div>
      <div className="home-layout">
        <header className="home-hero">
          <div className="home-title-lockup">
            <p className="home-kicker">OURHOME</p>
            <h1>我们的家</h1>
          </div>
          <button className={`home-refresh ${refreshing ? 'is-refreshing' : ''}`} type="button" onClick={refreshHome} aria-label="刷新主页" title="刷新主页">
            <svg viewBox="0 0 40 44" aria-hidden="true"><path d="M15 5h10M20 5v5" /><circle cx="20" cy="25" r="13" /><path d="M20 17v8l6 4M10 12l-4 5M30 12l4 5" /></svg>
          </button>
          <p className="home-anniversary"><i>♥</i> 相伴第 {anniversaryDay(now)} 天 <span>· since 2025.03.07</span></p>
        </header>

        <section className="home-timeline" aria-label={`当前时间 ${clockText(now)}`}>
          <div className="home-timeline-heading"><span>今天的轨迹</span><b>{clockText(now)}</b></div>
          <div className="home-timeline-window">
            <span className="home-now-glow" aria-hidden="true" />
            <div className="home-moving-scale" style={{ '--timeline-shift': `${timeline.offset * 68}px` }} aria-hidden="true">
              {timeline.ticks.map(tick => <span className={tick.major ? 'is-major' : ''} key={tick.key}><i /><b>{tick.label}</b></span>)}
            </div>
            <span className="home-companion-station"><TimelineCompanion /></span>
            <span className="home-time-marker" aria-hidden="true" />
          </div>
          <p>✦ {phraseFor(now.getHours())} ✦</p>
        </section>

        <section className="home-quick-grid" aria-label="天气日历与便签">
          <button className="home-calendar-card" type="button" onClick={() => onOpen('calendar')} aria-label="打开心情日历">
            <span className="home-card-overline">TODAY</span>
            <strong>{clockText(now)}</strong>
            <small>{city ? `${weather?.displayName || city} · ${weatherLine}` : weatherLine}</small>
            <span className="home-calendar-link"><i>♡</i> 心情日历 <b>›</b></span>
          </button>

          <button className="home-note-card" type="button" onClick={() => setMemoOpen(true)} aria-label="打开我们的小便签">
            <span className="home-note-pin" aria-hidden="true" />
            <span className="home-card-overline">OUR NOTES</span>
            <strong>我们的小便签 <i>＋</i></strong>
            <p>{memoState === 'loading' ? '正在翻找便签…' : featuredMemo?.content || '给彼此留一句话'}</p>
            <small>{featuredMemo ? `${featuredMemo.author === '泽' ? '泽' : '檀'} · ${featuredMemo.memo_type === 'tomorrow' ? '明日备忘' : '温馨提示'}` : '檀和泽都可以写'}</small>
          </button>
        </section>

        <section className="home-story-card" aria-label="客厅里的时光信差与猫的金库">
          <div className="home-room-window" aria-hidden="true"><i /><i /><span /></div>
          <div className="home-room-moulding" aria-hidden="true" />
          <div className="home-console-table" aria-hidden="true"><i /><i /></div>
          <button className="home-mailbox-hit" type="button" onClick={() => onOpen('letters')} aria-label="打开时光信差">
            <span className="home-story-index">LETTERS · 01</span>
            <strong>时光信差</strong>
            <small>幸福日记 · 悄悄话</small>
            <i>把今天寄给未来 <b>↗</b></i>
            <MailboxIllustration />
          </button>
          <button className="home-vault-hit" type="button" onClick={() => onOpen('vault')} aria-label="打开猫的金库">
            <VaultCatIllustration />
            <span><b>猫的金库</b><small>一起攒下小日子</small></span>
            <i>›</i>
          </button>
        </section>

        <nav className="home-dock" aria-label="主页房间导航">
          <button type="button" onClick={() => onOpen('memories')}>
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6h8c2 0 3 1 3 3v18c0-2-1-3-3-3H5V6Zm22 0h-8c-2 0-3 1-3 3v18c0-2 1-3 3-3h8V6Z" /><path d="M9 11h4M19 11h4M9 15h4M19 15h4" /></svg>
            <span>记忆</span>
          </button>
          <button className="home-chat-button" type="button" onClick={() => onOpen('chat')} aria-label="打开聊天">
            <CoupleAvatar mine={avatars.mine} partner={avatars.partner} />
            <span>chat</span>
          </button>
          <button type="button" onClick={() => onOpen('settings')}>
            <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 4h6l1 4 4 2 4-1 3 6-3 3v4l3 3-3 6-4-1-4 2-1 4h-6l-1-4-4-2-4 1-3-6 3-3v-4l-3-3 3-6 4 1 4-2 1-4Z" transform="scale(.8) translate(4 -2)"/><circle cx="16" cy="16" r="4" /></svg>
            <span>设置</span>
          </button>
        </nav>
      </div>

      {memoOpen && <MemoDrawer memos={memos} loading={memoState === 'loading'} error={memoError} onClose={() => setMemoOpen(false)} onSave={saveMemo} onToggle={toggleMemo} onDelete={deleteMemo} />}
    </main>
  );
}
