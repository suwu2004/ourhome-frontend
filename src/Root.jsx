import { lazy, Suspense, useEffect, useState } from 'react';
import { HomeHub } from './HomeHub.jsx';
import OurHomeAccessGate, { useOurHomeAccess } from './OurHomeAccessGate.jsx';
import RoomBoundary from './RoomBoundary.jsx';
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
import { emitGlobalSync } from './globalSync.js';
import {
  consumeNativeRemotePushRoute,
  isNativeAndroidApp,
  listenNativeRemotePushActions,
} from './nativeNotifications.js';

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

export default function Root() {
  const { refreshTheme } = useTheme();
  const [unlocked, setUnlocked] = useOurHomeAccess();
  const [room, setRoom] = useState(roomFromHash);
  const [homeRefreshToken, setHomeRefreshToken] = useState(0);
  const [persistentAppMounted, setPersistentAppMounted] = useState(() => persistentAppRoomKeys.has(roomFromHash()));
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
    if (!isNativeAndroidApp()) return undefined;
    let disposed = false;
    let removeListener = () => {};

    const openRemotePushTarget = payload => {
      if (disposed) return;
      const requested = String(payload?.route || 'home');
      const nextRoom = roomKeys.has(requested) ? requested : 'home';
      if (nextRoom === 'home') {
        window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
        setRoom('home');
        return;
      }
      if (persistentAppRoomKeys.has(nextRoom)) {
        setPersistentAppMounted(true);
        setLastPersistentRoom(nextRoom);
      }
      window.location.hash = nextRoom;
      setRoom(nextRoom);
    };

    (async () => {
      try {
        removeListener = await listenNativeRemotePushActions(openRemotePushTarget);
        const pending = await consumeNativeRemotePushRoute();
        if (pending) openRemotePushTarget(pending);
      } catch (error) {
        console.error('原生推送跳转没有接好', error);
      }
    })();

    return () => {
      disposed = true;
      removeListener();
    };
  }, []);

  useEffect(() => {
    if (!persistentAppRoomKeys.has(room)) return;
    setPersistentAppMounted(true);
    setLastPersistentRoom(room);
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
    if (persistentAppRoomKeys.has(key)) {
      setPersistentAppMounted(true);
      setLastPersistentRoom(key);
    }
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
            emitGlobalSync({ source: 'home', scope: 'all' });
            refreshTheme();
          }}
          refreshToken={homeRefreshToken}
        />
      </>
    );
  }

  const persistentAppVisible = persistentAppRoomKeys.has(room);
  const activePersistentRoom = persistentAppVisible ? room : lastPersistentRoom;
  const renderPersistentApp = persistentAppMounted || persistentAppVisible;

  return (
    <>
      {foregroundRoom}
      {renderPersistentApp && (
        <div
          aria-hidden={!persistentAppVisible}
          style={{
            display: persistentAppVisible ? 'block' : 'none',
            position: 'fixed',
            inset: 0,
            zIndex: persistentAppVisible ? 1 : -1,
          }}
        >
          <RoomBoundary room={activePersistentRoom} onHome={goHome}>
            <Suspense fallback={<div className="room-loading-shell" role="status">正在打开房间…</div>}>
              <App initialView={activePersistentRoom} onHome={goHome} />
              {activePersistentRoom === 'theater' && <TheaterRuleLibrary />}
              {activePersistentRoom === 'settings' && (
                <>
                  <ApiUsageLogPanel />
                  <LuzeAutonomySettingsPanel />
                </>
              )}
            </Suspense>
          </RoomBoundary>
        </div>
      )}
    </>
  );
}
