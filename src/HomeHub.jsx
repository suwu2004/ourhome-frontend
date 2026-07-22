import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { getHomeWeatherCity, HOME_PREFERENCES_EVENT } from './homePreferences.js';
import { occasionReminderText, upcomingOccasions } from './milestoneDates.js';
import { useTheme } from './ThemeContext.jsx';
import '@fontsource/parisienne/400.css';

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

function GoldenMoodStar() {
  return (
    <svg className="home-mood-star" viewBox="0 0 56 56" aria-hidden="true">
      <circle className="home-star-halo" cx="28" cy="28" r="25" />
      <path className="home-star-rays" d="M28 3v7M28 46v7M3 28h7M46 28h7M10.3 10.3l5 5M40.7 40.7l5 5M45.7 10.3l-5 5M15.3 40.7l-5 5" />
      <path className="home-star-body" d="M28 9.5c2.6 9.6 8.9 15.9 18.5 18.5-9.6 2.6-15.9 8.9-18.5 18.5C25.4 36.9 19.1 30.6 9.5 28 19.1 25.4 25.4 19.1 28 9.5Z" />
      <path className="home-star-heart" d="M28 33.8c-7-4.3-7.3-9-.2-7.1 7.1-1.9 6.8 2.8.2 7.1Z" />
    </svg>
  );
}

function MailboxIllustration() {
  return (
    <svg className="home-mailbox-art" viewBox="0 0 132 112" aria-hidden="true">
      <path className="home-mailbox-fill" d="M19 65V40c0-16 13-29 29-29h35c17 0 30 13 30 30v24H19Z" />
      <path className="home-mailbox-outline" d="M19 65V40c0-16 13-29 29-29h35c17 0 30 13 30 30v24H19Zm42 0V40c0-16-7-29-19-29m18 54v36m-20 0h42" />
      <path className="home-mailbox-slot" d="M31 32h20" />
      <path className="home-mailbox-flag" d="M96 17v31m0-29h21l-4 11H96" />
      <path className="home-mailbox-letter" d="M30 43h21v14H30V43Zm1 1 9.5 7L50 44" />
      <path className="home-mailbox-heart" d="M77 39c-5-5-11 2 0 10 11-8 5-15 0-10Z" />
      <path className="home-mailbox-ground" d="M12 101h108" />
    </svg>
  );
}

function VaultCatIllustration() {
  return (
    <svg className="home-vault-cat" viewBox="0 0 142 92" aria-hidden="true">
      <path className="home-cat-wash" d="M20 67c2-24 22-42 50-42 31 0 52 19 51 43-22 15-79 16-101-1Z" />
      <path className="home-cat-line" d="M24 67c3-23 22-40 49-40 12 0 23 3 31 10m-80 30c18 14 70 15 94 2 12-7 12-23 2-28-9-5-20 2-16 12 3 8 16 7 20-1" />
      <path className="home-cat-line" d="M44 45c-1-12 3-23 13-30l7 10c7-3 15-3 22 0l8-10c9 9 12 20 9 31-3 13-14 21-30 21-16 0-27-8-29-22Z" />
      <path className="home-cat-face" d="M58 43c3 3 7 3 10 0m11 0c3 3 7 3 10 0m-16 4c0 4 3 6 7 6m-29-6-10-2m11 8-10 2m55-8 10-2m-11 8 10 2" />
      <path className="home-cat-heart" d="M34 27c-5-6-13 1 0 11 13-10 5-17 0-11Z" />
    </svg>
  );
}

function MemoFriendsIllustration({ compact = false }) {
  return (
    <svg className={`home-note-friends ${compact ? 'home-note-friends--compact' : ''}`} viewBox="0 0 150 66" aria-hidden="true">
      <path className="home-note-friend-wash home-note-friend-wash--fox" d="M9 52c3-23 18-39 39-39 18 0 31 12 33 30-12 17-54 22-72 9Z" />
      <path className="home-note-friend-line" d="M25 39 18 18l18 9c7-4 15-4 23 0l18-9-8 22c-3 13-13 19-25 19-12 0-21-7-19-20Z" />
      <path className="home-note-friend-line" d="M34 42c3 3 6 3 9 0m10 0c3 3 6 3 9 0m-15 3c0 4 3 6 7 6" />
      <path className="home-note-friend-wash home-note-friend-wash--cat" d="M82 54c2-19 15-32 33-32 17 0 28 11 29 29-13 12-45 15-62 3Z" />
      <path className="home-note-friend-line" d="M91 43c-1-12 3-22 12-28l7 9c6-2 12-2 18 0l7-9c8 8 10 18 8 29-2 11-12 17-26 17-14 0-23-7-26-18Z" />
      <path className="home-note-friend-line" d="M103 43c3 3 6 3 9 0m10 0c3 3 6 3 9 0m-15 4c0 3 3 5 6 5m-23-5-9-2m10 8-9 2m43-8 8-2m-9 8 8 2" />
      <path className="home-note-friend-heart" d="M79 20c-4-5-10 1 0 9 10-8 4-14 0-9Z" />
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

function MemoDrawer({ memos, upcoming, loading, error, onClose, onSave, onToggle, onDelete }) {
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
          <div><span>OUR NOTES</span><h2 id="home-memo-title">云端小便签</h2><p>一些温柔的话，和明天别忘记的事。</p></div>
          <MemoFriendsIllustration />
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

        {upcoming.length > 0 && (
          <section className="home-memo-countdowns" aria-label="十天内的重要日子">
            <header><span>COMING SOON</span><b>快到的小日子</b></header>
            <div>
              {upcoming.slice(0, 3).map(occasion => (
                <article key={occasion.id}>
                  <i>{occasion.kind === 'birthday' ? '🎂' : occasion.kind === 'festival' ? '♡' : '✦'}</i>
                  <p>{occasionReminderText(occasion)}</p>
                  <time dateTime={occasion.date}>{occasion.date.slice(5).replace('-', '.')}</time>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="home-memo-list">
          <div className="home-memo-list-title"><span>PINNED TOGETHER</span><b>我们的纸条</b></div>
          {loading && <p className="home-memo-empty">正在翻找便签…</p>}
          {!loading && error && <p className="home-memo-empty home-memo-empty--error">{error}</p>}
          {!loading && !error && memos.length === 0 && <p className="home-memo-empty">这里还空着，先留下一句吧。</p>}
          {memos.map(memo => (
            <article className={`home-memo-item home-memo-item--${memo.author === '泽' ? 'ze' : 'tan'} ${memo.completed ? 'is-complete' : ''}`} key={memo.id}>
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
  const [milestones, setMilestones] = useState([]);
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

  const loadMilestones = useCallback(async () => {
    try {
      const response = await apiFetch(`${BACKEND}/milestones`);
      const data = await response.json().catch(() => []);
      if (response.ok) setMilestones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('重要日子暂时没有回来', error);
    }
  }, []);

  useEffect(() => {
    loadMemos();
    loadMilestones();
  }, [loadMemos, loadMilestones, refreshToken]);

  useEffect(() => {
    if (!refreshing) return undefined;
    const timer = window.setTimeout(() => setRefreshing(false), 650);
    return () => window.clearTimeout(timer);
  }, [refreshing]);

  const timeline = useMemo(() => movingTimeline(now), [now]);
  const weatherDescription = describeWeather(weather?.weatherCode, weather?.isDay);
  const featuredMemo = memos.find(memo => !memo.completed) || memos[0] || null;
  const upcoming = useMemo(() => upcomingOccasions(milestones, now, 10), [milestones, now]);
  const featuredNoteText = upcoming[0]
    ? occasionReminderText(upcoming[0])
    : featuredMemo?.content || '留一句话……';
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
            <h1>OurHome</h1>
          </div>
          <button className={`home-refresh ${refreshing ? 'is-refreshing' : ''}`} type="button" onClick={refreshHome} aria-label="刷新主页" title="刷新主页">
            <svg viewBox="0 0 40 44" aria-hidden="true"><path d="M15 5h10M20 5v5" /><circle cx="20" cy="25" r="13" /><path d="M20 17v8l6 4M10 12l-4 5M30 12l4 5" /></svg>
          </button>
          <p className="home-anniversary"><i>♥</i> 相伴第 {anniversaryDay(now)} 天 <span>· since 2025.03.07</span></p>
        </header>

        <section className="home-timeline" aria-label={`当前时间 ${clockText(now)}`}>
          <div className="home-timeline-heading">
            <b>{clockText(now)}</b>
            <span>{city ? `${weather?.displayName || city} · ${weatherLine}` : weatherLine}</span>
          </div>
          <div className="home-timeline-window">
            <span className="home-now-glow" aria-hidden="true" />
            <div className="home-moving-scale" style={{ '--timeline-shift': `${timeline.offset * 68}px` }} aria-hidden="true">
              {timeline.ticks.map(tick => <span className={tick.major ? 'is-major' : ''} key={tick.key}><i /><b>{tick.label}</b></span>)}
            </div>
            <button className="home-companion-station" type="button" onClick={() => onOpen('calendar')} aria-label="打开心情日历" title="心情日历"><GoldenMoodStar /></button>
            <span className="home-time-marker" aria-hidden="true" />
          </div>
          <p>✦ {phraseFor(now.getHours())} ✦</p>
        </section>

        <section className="home-quick-grid" aria-label="我们的小便签">
          <button className="home-note-card" type="button" onClick={() => setMemoOpen(true)} aria-label="打开我们的小便签">
            <span className="home-card-overline">OUR NOTES</span>
            <i className="home-note-add">＋</i>
            <p>{memoState === 'loading' ? '正在翻找便签…' : featuredNoteText}</p>
            <MemoFriendsIllustration compact />
          </button>
        </section>

        <section className="home-room-shelf" aria-label="客厅里的小房间">
          <button className="home-room-app home-room-app--letters" type="button" onClick={() => onOpen('letters')} aria-label="打开时光信差">
            <span><MailboxIllustration /></span>
            <strong>时光信差</strong>
          </button>
          <button className="home-room-app home-room-app--vault" type="button" onClick={() => onOpen('vault')} aria-label="打开猫的金库">
            <span><VaultCatIllustration /></span>
            <strong>猫的金库</strong>
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

      {memoOpen && <MemoDrawer memos={memos} upcoming={upcoming} loading={memoState === 'loading'} error={memoError} onClose={() => setMemoOpen(false)} onSave={saveMemo} onToggle={toggleMemo} onDelete={deleteMemo} />}
    </main>
  );
}
