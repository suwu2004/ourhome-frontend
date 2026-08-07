import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App.jsx';
import { HomeHub } from './HomeHub.jsx';
import ReadingRoom from './ReadingRoom.jsx';
import ReadingCompanionPanel from './ReadingCompanionPanel.jsx';
import ReadingShelfLiveNote from './ReadingShelfLiveNote.jsx';
import ToyBoxRoom from './ToyBoxRoom.jsx';
import './ReadingHomeEntry.css';
import './HomeRoomGrid.css';
import './ReadingLuZeReply.css';
import './ReadingMobileFix.css';
import { useTheme } from './ThemeContext.jsx';
import VaultPage from './VaultPage.jsx';
import TheaterRuleLibrary from './TheaterRuleLibrary.jsx';

const roomKeys = new Set(['chat', 'theater', 'music', 'reading', 'letters', 'memories', 'calendar', 'vault', 'photos', 'settings', 'toybox']);

function roomFromHash() {
  const key = window.location.hash.replace(/^#/, '');
  return roomKeys.has(key) ? key : 'home';
}

function useHomeShelfTarget() {
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

  return target && document.body.contains(target) ? target : null;
}

function ReadingHomeEntry({ onOpen }) {
  const target = useHomeShelfTarget();
  if (!target) return null;
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

function ToyboxHomeEntry({ onOpen }) {
  const target = useHomeShelfTarget();
  if (!target) return null;
  return createPortal(
    <button className="home-room-app home-room-app--toybox" type="button" onClick={onOpen} aria-label="打开玩具箱">
      <span>
        <svg className="home-room-glyph home-bear-icon" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="11" cy="11" r="5" />
          <circle cx="25" cy="11" r="5" />
          <path d="M8.5 20c0-7.7 4.2-12 9.5-12s9.5 4.3 9.5 12-4.2 11-9.5 11S8.5 27.7 8.5 20Z" />
          <circle cx="14" cy="19" r="1.3" />
          <circle cx="22" cy="19" r="1.3" />
          <path d="M16 24c1.4 1.2 2.6 1.2 4 0M18 22.5V25" />
        </svg>
      </span>
      <strong>玩具箱</strong>
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
  if (room === 'toybox') return <ToyBoxRoom onClose={goHome} />;
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
      <ToyboxHomeEntry onOpen={() => openRoom('toybox')} />
    </>
  );
}
