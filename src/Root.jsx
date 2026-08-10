import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { HomeHub } from './HomeHub.jsx';
import OurHomeAccessGate, { useOurHomeAccess } from './OurHomeAccessGate.jsx';
import RoomBoundary from './RoomBoundary.jsx';
import '@fontsource/ma-shan-zheng/chinese-simplified-400.css';
import './ReadingHomeEntry.css';
import './HomeRoomGrid.css';
import './ToyBoxBudget.css';
import './ToolBearPolish.css';
import './ReadingLuZeReply.css';
import './ReadingMobileFix.css';
import './MobileUiPolish.css';
import './UnifiedRoomHeaders.css';
import './RoomHeaderFinal.css';
import './DecorativeTypographyPolish.css';
import { useTheme } from './ThemeContext.jsx';

const App = lazy(() => import('./App.jsx'));
const ReadingRoom = lazy(() => import('./ReadingRoom.jsx'));
const ReadingCompanionPanel = lazy(() => import('./ReadingCompanionPanel.jsx'));
const ReadingShelfLiveNote = lazy(() => import('./ReadingShelfLiveNote.jsx'));
const ToyBoxSharedRoom = lazy(() => import('./ToyBoxSharedRoom.jsx'));
const ToyBoxGomokuIntegrationV2 = lazy(() => import('./ToyBoxGomokuIntegrationV2.jsx'));
const ToolBearGameDock = lazy(() => import('./ToolBearGameDock.jsx'));
const ApiUsageLogPanel = lazy(() => import('./ApiUsageLogPanel.jsx'));
const LuzeAutonomySettingsPanel = lazy(() => import('./LuzeAutonomySettingsPanel.jsx'));
const LuzePrivateRoom = lazy(() => import('./LuzePrivateRoom.jsx'));
const VaultPage = lazy(() => import('./VaultPage.jsx'));
const TheaterRuleLibrary = lazy(() => import('./TheaterRuleLibrary.jsx'));

const roomKeys = new Set(['chat', 'theater', 'music', 'reading', 'letters', 'memories', 'calendar', 'vault', 'photos', 'settings', 'toybox', 'luze-room']);
const persistentAppRoomKeys = new Set(['chat', 'theater', 'music', 'letters', 'memories', 'calendar', 'photos', 'settings']);

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

function ReadingHomeEntry({ onOpen, target }) {
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

function ToyboxHomeEntry({ onOpen, target }) {
  return createPortal(
    <button className="home-room-app home-room-app--toybox" type="button" onClick={onOpen} aria-label="打开玩具熊">
      <span>
        <span className="home-toolbear-symbol" aria-hidden="true">୨୧</span>
      </span>
      <strong>玩具熊</strong>
    </button>,
    target,
  );
}

function LuzeRoomHomeEntry({ onOpen, target }) {
  return createPortal(
    <button className="home-room-app home-room-app--luze" type="button" onClick={onOpen} aria-label="去陆泽的房间敲门">
      <span>
        <svg className="home-room-glyph home-luze-door-glyph" viewBox="0 0 36 36" aria-hidden="true">
          <path d="M10 29V10.8c0-2 1.2-3.3 3.1-3.3h10c1.9 0 2.9 1.3 2.9 3.3V29" />
          <path d="M13.7 29V12h8.6v17M7.5 29h21" />
          <circle cx="20" cy="20.5" r="1.15" />
          <path d="M16.1 11.2h3.8" />
        </svg>
      </span>
      <strong>陆泽的房间</strong>
    </button>,
    target,
  );
}

function HomeShelfEntries({ onOpen }) {
  const target = useHomeShelfTarget();
  if (!target) return null;
  return (
    <>
      <ReadingHomeEntry target={target} onOpen={() => onOpen('reading')} />
      <ToyboxHomeEntry target={target} onOpen={() => onOpen('toybox')} />
      <LuzeRoomHomeEntry target={target} onOpen={() => onOpen('luze-room')} />
    </>
  );
}

export default function Root() {
  const { refreshTheme } = useTheme();
  const [unlocked, setUnlocked] = useOurHomeAccess();
  const [room, setRoom] = useState(roomFromHash);
  const [homeRefreshToken, setHomeRefreshToken] = useState(0);
  const [lastPersistentRoom, setLastPersistentRoom] = useState(() => {
    const initialRoom = roomFromHash();
    return persistentAppRoomKeys.has(initialRoom) ? initialRoom : 'chat';
  });

  useEffect(() => {
    const syncRoom = () => setRoom(roomFromHash());
    window.addEventListener('hashchange', syncRoom);
    window.addEventListener('popstate', syncRoom);
    return () => {
      window.removeEventListener('hashchange', syncRoom);
      window.removeEventListener('popstate', syncRoom);
    };
  }, []);

  useEffect(() => {
    if (persistentAppRoomKeys.has(room)) setLastPersistentRoom(room);
  }, [room]);

  useEffect(() => {
    if (!unlocked) {
      delete document.body.dataset.ourhomeRoom;
      return undefined;
    }
    document.body.dataset.ourhomeRoom = room;
    return () => {
      if (document.body.dataset.ourhomeRoom === room) delete document.body.dataset.ourhomeRoom;
    };
  }, [room, unlocked]);

  const openRoom = key => {
    window.location.hash = key;
    setRoom(key);
  };

  const goHome = () => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    setRoom('home');
    refreshTheme();
  };

  if (!unlocked) return <OurHomeAccessGate onUnlocked={() => setUnlocked(true)} />;

  const roomShell = children => (
    <RoomBoundary key={room} room={room} onHome={goHome}>
      <Suspense fallback={<div className="room-loading-shell" role="status">正在打开房间…</div>}>
        {children}
      </Suspense>
    </RoomBoundary>
  );

  let foregroundRoom = null;
  if (room === 'vault') {
    foregroundRoom = roomShell(<VaultPage onClose={goHome} />);
  } else if (room === 'luze-room') {
    foregroundRoom = roomShell(<LuzePrivateRoom onClose={goHome} />);
  } else if (room === 'toybox') {
    foregroundRoom = roomShell(
      <>
        <ToyBoxSharedRoom onClose={goHome} />
        <ToyBoxGomokuIntegrationV2 />
        <ToolBearGameDock />
      </>,
    );
  } else if (room === 'reading') {
    foregroundRoom = roomShell(
      <>
        <ReadingRoom onClose={goHome} />
        <ReadingShelfLiveNote />
        <ReadingCompanionPanel />
      </>,
    );
  } else if (room === 'home') {
    foregroundRoom = (
      <>
        <HomeHub
          onOpen={openRoom}
          onRefresh={() => {
            setHomeRefreshToken(value => value + 1);
            refreshTheme();
          }}
          refreshToken={homeRefreshToken}
        />
        <HomeShelfEntries onOpen={openRoom} />
      </>
    );
  }

  const persistentAppVisible = persistentAppRoomKeys.has(room);

  return (
    <>
      {foregroundRoom}
      <div
        aria-hidden={!persistentAppVisible}
        style={{
          display: persistentAppVisible ? 'block' : 'none',
          position: 'fixed',
          inset: 0,
          zIndex: persistentAppVisible ? 1 : -1,
        }}
      >
        <RoomBoundary room={lastPersistentRoom} onHome={goHome}>
          <Suspense fallback={<div className="room-loading-shell" role="status">正在打开房间…</div>}>
            <App initialView={lastPersistentRoom} onHome={goHome} />
            {lastPersistentRoom === 'theater' && <TheaterRuleLibrary />}
            {lastPersistentRoom === 'settings' && (
              <>
                <ApiUsageLogPanel />
                <LuzeAutonomySettingsPanel />
              </>
            )}
          </Suspense>
        </RoomBoundary>
      </div>
    </>
  );
}
