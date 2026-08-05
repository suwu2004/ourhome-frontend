import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App.jsx';
import { HomeHub } from './HomeHub.jsx';
import ReadingRoom from './ReadingRoom.jsx';
import ReadingCompanionPanel from './ReadingCompanionPanel.jsx';
import ReadingShelfLiveNote from './ReadingShelfLiveNote.jsx';
import './ReadingHomeEntry.css';
import './HomeRoomGrid.css';
import './ReadingLuZeReply.css';
import './ReadingMobileFix.css';
import { useTheme } from './ThemeContext.jsx';
import VaultPage from './VaultPage.jsx';
import TheaterRuleLibrary from './TheaterRuleLibrary.jsx';

const roomKeys = new Set(['chat', 'theater', 'music', 'reading', 'letters', 'memories', 'calendar', 'vault', 'photos', 'settings']);

function roomFromHash() {
  const key = window.location.hash.replace(/^#/, '');
  return roomKeys.has(key) ? key : 'home';
}

function ReadingHomeEntry({ onOpen }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let observer = null;
    let retryTimer = null;

    const findShelf = () => {
      const shelf = document.querySelector('.home-room-shelf');
      if (!shelf) return false;
      setTarget(current => (current === shelf ? current : shelf));
      return true;
    };

    if (!findShelf()) {
      observer = new MutationObserver(() => {
        if (findShelf()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      retryTimer = window.setInterval(findShelf, 300);
    }

    return () => {
      observer?.disconnect();
      if (retryTimer) window.clearInterval(retryTimer);
    };
  }, []);

  if (!target || !document.body.contains(target)) return null;
  return createPortal(
    <button className="home-room-app home-room-app--reading" type="button" onClick={onOpen} aria-label="打开共读小屋">
      <span>
        <svg className="home-room-glyph" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M5.5 8.5h10c1.8 0 2.5 1 2.5 2.8v17.2c0-1.8-.7-2.8-2.5-2.8h-10V8.5Zm25 0h-10c-1.8 0-2.5 1-2.5 2.8v17.2c0-1.8-.7-2.8-2.5-2.8h-10V8.5Z" />
          <path d="M9 13h5M22 13h5M9 17h5M22 17h5" />
        </svg>
      </span>
      <strong>共读小屋</strong>
    </button>,
    target,
  );
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
  if (room === 'reading') {
    return (
      <>
        <ReadingRoom onClose={goHome} />
        <ReadingShelfLiveNote />
        <ReadingCompanionPanel />
      </>
    );
  }
  if (room !== 'home') {
    return (
      <>
        <App key={room} initialView={room} onHome={goHome} />
        {room === 'theater' && <TheaterRuleLibrary />}
      </>
    );
  }

  return (
    <>
      <HomeHub
        onOpen={openRoom}
        onRefresh={() => {
          setHomeRefreshToken(value => value + 1);
          refreshTheme();
        }}
        refreshToken={homeRefreshToken}
      />
      <ReadingHomeEntry onOpen={() => openRoom('reading')} />
    </>
  );
}
