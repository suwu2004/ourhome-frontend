import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import App from './App.jsx';
import { HomeHub } from './HomeHub.jsx';
import ReadingRoom from './ReadingRoom.jsx';
import ReadingCompanionPanel from './ReadingCompanionPanel.jsx';
import ReadingShelfLiveNote from './ReadingShelfLiveNote.jsx';
import ToyBoxSharedRoom from './ToyBoxSharedRoom.jsx';
import ToyBoxGomokuIntegrationV2 from './ToyBoxGomokuIntegrationV2.jsx';
import ToolBearGameDock from './ToolBearGameDock.jsx';
import ApiUsageLogPanel from './ApiUsageLogPanel.jsx';
import LuzeAutonomySettingsPanel from './LuzeAutonomySettingsPanel.jsx';
import LuzePrivateRoom from './LuzePrivateRoom.jsx';
import OurHomeAccessGate, { useOurHomeAccess } from './OurHomeAccessGate.jsx';
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
import VaultPage from './VaultPage.jsx';
import TheaterRuleLibrary from './TheaterRuleLibrary.jsx';

const roomKeys = new Set(['chat', 'theater', 'music', 'reading', 'letters', 'memories', 'calendar', 'vault', 'photos', 'settings', 'toybox', 'luze-room']);

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
    <button className="home-room-app home-room-app--toybox" type="button" onClick={onOpen} aria-label="打开玩具熊">
      <span>
        <span className="home-toolbear-symbol" aria-hidden="true">୨୧</span>
      </span>
      <strong>玩具熊</strong>
    </button>,
    target,
  );
}

function LuzeRoomHomeEntry({ onOpen }) {
  const target = useHomeShelfTarget();
  if (!target) return null;
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

export default function Root() {
  const { refreshTheme } = useTheme();
  const [unlocked, setUnlocked] = useOurHomeAccess();
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

  if (room === 'vault') return <VaultPage onClose={goHome} />;
  if (room === 'luze-room') return <LuzePrivateRoom onClose={goHome} />;
  if (room === 'toybox') {
    return (
      <>
        <ToyBoxSharedRoom onClose={goHome} />
        <ToyBoxGomokuIntegrationV2 />
        <ToolBearGameDock />
      </>
    );
  }
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
        {room === 'settings' && (
          <>
            <ApiUsageLogPanel />
            <LuzeAutonomySettingsPanel />
          </>
        )}
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
      <LuzeRoomHomeEntry onOpen={() => openRoom('luze-room')} />
    </>
  );
}
