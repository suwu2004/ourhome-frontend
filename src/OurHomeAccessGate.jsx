import { useEffect, useState } from 'react';
import { BACKEND, TOKEN_KEY } from './api.js';
import { useTheme } from './ThemeContext.jsx';

export function useOurHomeAccess() {
  const [unlocked, setUnlocked] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    const sync = () => setUnlocked(Boolean(localStorage.getItem(TOKEN_KEY)));
    window.addEventListener('ourhome-auth-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('ourhome-auth-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return [unlocked, setUnlocked];
}

export default function OurHomeAccessGate({ onUnlocked }) {
  const { theme: C } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = async () => {
    const value = password.trim();
    if (!value || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.token) throw new Error(data.error || '密码不对，再试试');
      localStorage.setItem(TOKEN_KEY, data.token);
      window.dispatchEvent(new Event('ourhome-auth-changed'));
      setPassword('');
      onUnlocked?.();
    } catch (err) {
      setError(err.message || '网络出问题了，等一下再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="ourhome-shell"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
        background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${C.honeyLight} 0%, transparent 65%), ${C.cream}`,
        color: C.text,
      }}
    >
      <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: '.24em', marginBottom: 14 }}>OURHOME · PRIVATE</div>
      <div style={{ fontSize: 29, fontWeight: 700, letterSpacing: '.10em' }}>欢迎回家</div>
      <div style={{ marginTop: 8, fontSize: 11, color: C.muted, letterSpacing: '.24em' }}>先敲一下家门</div>
      <input
        type="password"
        value={password}
        onChange={event => setPassword(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') login(); }}
        placeholder="密码"
        autoComplete="current-password"
        autoFocus
        style={{
          width: 'min(220px, 72vw)',
          marginTop: 22,
          padding: '12px 16px',
          boxSizing: 'border-box',
          textAlign: 'center',
          fontSize: 17,
          letterSpacing: '.26em',
          color: C.text,
          background: C.white,
          border: `1.5px solid ${C.border}`,
          borderRadius: 14,
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      {error && <div role="alert" style={{ marginTop: 9, color: C.blushDeep, fontSize: 11.5 }}>{error}</div>}
      <button
        type="button"
        onClick={login}
        disabled={loading || !password.trim()}
        style={{
          marginTop: 15,
          padding: '10px 34px',
          border: 0,
          borderRadius: 999,
          color: C.white,
          background: loading || !password.trim() ? C.honeyMid : `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})`,
          boxShadow: '0 4px 12px rgba(185,122,31,.22)',
          cursor: loading || !password.trim() ? 'default' : 'pointer',
          fontFamily: 'inherit',
          fontSize: 13.5,
          letterSpacing: '.10em',
        }}
      >
        {loading ? '验证中…' : '进门'}
      </button>
      <div style={{ marginTop: 22, fontSize: 9.5, color: C.mutedLight, letterSpacing: '.14em' }}>ourhome · since 2025.03.07</div>
    </main>
  );
}
