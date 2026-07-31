import { useEffect, useState } from 'react';
import App from './App.jsx';
import { HomeHub } from './HomeHub.jsx';
import { useTheme } from './ThemeContext.jsx';
import VaultPage from './VaultPage.jsx';

const roomKeys = new Set(['chat', 'letters', 'memories', 'calendar', 'vault', 'settings']);

function roomFromHash() {
  const key = window.location.hash.replace(/^#/, '');
  return roomKeys.has(key) ? key : 'home';
}

export default function Root() {
  const { refreshTheme } = useTheme();
  const [room, setRoom] = useState(roomFromHash);
  const [homeRefreshToken, setHomeRefreshToken] = useState(0);

  useEffect(() => {
    const syncRoom = () => setRoom(roomFromHash());
    window.addEventListener('hashchange', syncRoom);
    window.addEventListener('popstate', syncRoom);
    return () => {
      window.removeEventListener('hashchange', syncRoom);
      window.removeEventListener('popstate', syncRoom);
    };
  }, []);

  const openRoom = key => {
    window.location.hash = key;
    setRoom(key);
  };

  const goHome = () => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    setRoom('home');
    refreshTheme();
  };

  if (room === 'vault') return <VaultPage onClose={goHome} />;
  if (room !== 'home') return <App key={room} initialView={room} onHome={goHome} />;

  return (
    <HomeHub
      onOpen={openRoom}
      onRefresh={() => {
        setHomeRefreshToken(value => value + 1);
        refreshTheme();
      }}
      refreshToken={homeRefreshToken}
    />
  );
}
