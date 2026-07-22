import { useEffect, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { getHomeWeatherCity, HOME_PREFERENCES_EVENT } from './homePreferences.js';
import { useTheme } from './ThemeContext.jsx';

const ANNIVERSARY_START = Date.UTC(2025, 2, 7);

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

function timelineFor(date) {
  const hour = date.getHours();
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  if (hour >= 6 && hour < 18) {
    start.setHours(6);
  } else if (hour >= 18) {
    start.setHours(18);
  } else {
    start.setDate(start.getDate() - 1);
    start.setHours(18);
  }
  const progress = Math.min(1, Math.max(0, (date.getTime() - start.getTime()) / (12 * 60 * 60 * 1000)));
  const labels = Array.from({ length: 7 }, (_, index) => {
    const value = (start.getHours() + index * 2) % 24;
    return `${String(value).padStart(2, '0')}:00`;
  });
  return { progress, labels };
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

function TimelineCompanion() {
  return (
    <svg className="home-timeline-companion" viewBox="0 0 54 66" aria-hidden="true">
      <path d="M17 19c1-9 7-15 15-14 7 1 11 6 11 14-6-5-17-6-26 0Z" fill="#60422f" />
      <circle cx="29" cy="22" r="10" fill="#f4c9a8" />
      <path d="M21 17c4-7 14-8 19-2-4 1-8 0-12-2-1 3-4 5-7 6Z" fill="#4b3428" />
      <path d="M23 34c4-3 10-3 14 0l5 19H18l5-19Z" fill="#9b7656" />
      <path d="M18 36 9 47M40 36l8 11" stroke="#75533d" strokeWidth="5" strokeLinecap="round" />
      <path d="m19 51-4 12M39 51l5 12" stroke="#4b3428" strokeWidth="5" strokeLinecap="round" />
      <path d="M38 35c4 1 6 4 6 9v7h-7V37Z" fill="#c39464" />
      <circle cx="26" cy="22" r="1" fill="#4b3428" />
      <circle cx="34" cy="22" r="1" fill="#4b3428" />
      <path d="M28 27c2 1 4 1 6 0" stroke="#b56f61" strokeWidth="1" fill="none" strokeLinecap="round" />
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

export function HomeHub({ onOpen, onRefresh, refreshToken = 0 }) {
  const { darkMode, settings } = useTheme();
  const [now, setNow] = useState(() => new Date());
  const [city, setCity] = useState(getHomeWeatherCity);
  const [weather, setWeather] = useState(null);
  const [weatherState, setWeatherState] = useState('idle');
  const [refreshing, setRefreshing] = useState(false);

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

  const timeline = timelineFor(now);
  const markerPosition = Math.min(0.97, Math.max(0.03, timeline.progress));
  const weatherDescription = describeWeather(weather?.weatherCode, weather?.isDay);
  const avatars = {
    mine: settings?.my_avatar_url || '',
    partner: settings?.partner_avatar_url || '',
  };

  useEffect(() => {
    if (!refreshing) return undefined;
    const timer = window.setTimeout(() => setRefreshing(false), 650);
    return () => window.clearTimeout(timer);
  }, [refreshing]);

  const refreshHome = () => {
    setNow(new Date());
    setRefreshing(true);
    onRefresh();
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
      <picture className="home-scene-picture" aria-hidden="true">
        <img className="home-scene-art" src={darkMode ? '/home-night-v1.webp' : '/home-day-v1.webp'} alt="" />
      </picture>
      <div className="home-scene-shade" aria-hidden="true" />

      <header className="home-hero">
        <p className="home-kicker">OurHome</p>
        <h1>我们的家</h1>
        <p className="home-anniversary">相伴第 {anniversaryDay(now)} 天 <span>· since 2025.03.07</span></p>
      </header>

      <button className={`home-refresh ${refreshing ? 'is-refreshing' : ''}`} type="button" onClick={refreshHome} aria-label="刷新主页" title="刷新主页">
        <svg viewBox="0 0 40 44" aria-hidden="true">
          <path d="M15 5h10M20 5v5" />
          <circle cx="20" cy="25" r="13" />
          <path d="M20 17v8l6 4M10 12l-4 5M30 12l4 5" />
        </svg>
      </button>

      <section className="home-timeline" aria-label={`当前时间 ${clockText(now)}`}>
        <div className="home-track">
          <span className="home-track-fill" style={{ width: `${timeline.progress * 100}%` }} />
          <span className="home-time-marker" style={{ left: `${markerPosition * 100}%` }}>
            <i>♥</i><b>{clockText(now)}</b>
          </span>
          <span className="home-companion-station"><TimelineCompanion /></span>
        </div>
        <div className="home-track-labels">
          {timeline.labels.map(label => <span key={label}>{label}</span>)}
        </div>
        <p>✦&nbsp; {phraseFor(now.getHours())} &nbsp;✦</p>
      </section>

      <button className="home-calendar-card" type="button" onClick={() => onOpen('calendar')} aria-label="打开心情日历">
        <span className="home-current-time">{clockText(now)}</span>
        <span className="home-weather-line">{weatherLine}</span>
        {city && <small>{weather?.displayName || city}</small>}
        <span className="home-calendar-link"><i>♡</i> 心情日历 <b>›</b></span>
      </button>

      <button className="home-mailbox-hit" type="button" onClick={() => onOpen('letters')} aria-label="打开时光信差">
        <span>时光信差</span>
        <small>幸福日记 · 悄悄话</small>
      </button>

      <button className="home-vault-hit" type="button" onClick={() => onOpen('vault')} aria-label="打开猫的金库">
        <span>猫的金库</span><b>›</b>
      </button>

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
    </main>
  );
}
