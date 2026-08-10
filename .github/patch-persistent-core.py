from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


root_path = Path('src/Root.jsx')
root = root_path.read_text()
root = replace_once(
    root,
    "const roomKeys = new Set(['chat', 'theater', 'music', 'reading', 'letters', 'memories', 'calendar', 'vault', 'photos', 'settings', 'toybox', 'luze-room']);",
    "const roomKeys = new Set(['chat', 'theater', 'music', 'reading', 'letters', 'memories', 'calendar', 'vault', 'photos', 'settings', 'toybox', 'luze-room']);\nconst appRoomKeys = new Set(['chat', 'theater', 'music', 'letters', 'memories', 'calendar', 'photos', 'settings']);",
    'Root app room set',
)
root = replace_once(
    root,
    "  const [room, setRoom] = useState(roomFromHash);\n  const [homeRefreshToken, setHomeRefreshToken] = useState(0);",
    "  const [room, setRoom] = useState(roomFromHash);\n  const [coreMounted, setCoreMounted] = useState(() => appRoomKeys.has(roomFromHash()));\n  const [lastCoreRoom, setLastCoreRoom] = useState(() => {\n    const initialRoom = roomFromHash();\n    return appRoomKeys.has(initialRoom) ? initialRoom : 'chat';\n  });\n  const [homeRefreshToken, setHomeRefreshToken] = useState(0);",
    'Root persistent state',
)
root = replace_once(
    root,
    "  useEffect(() => {\n    const syncRoom = () => setRoom(roomFromHash());\n    window.addEventListener('hashchange', syncRoom);\n    window.addEventListener('popstate', syncRoom);\n    return () => {\n      window.removeEventListener('hashchange', syncRoom);\n      window.removeEventListener('popstate', syncRoom);\n    };\n  }, []);\n",
    "  useEffect(() => {\n    const syncRoom = () => setRoom(roomFromHash());\n    window.addEventListener('hashchange', syncRoom);\n    window.addEventListener('popstate', syncRoom);\n    return () => {\n      window.removeEventListener('hashchange', syncRoom);\n      window.removeEventListener('popstate', syncRoom);\n    };\n  }, []);\n\n  useEffect(() => {\n    if (!appRoomKeys.has(room)) return;\n    setCoreMounted(true);\n    setLastCoreRoom(room);\n  }, [room]);\n",
    'Root core mount effect',
)
root = replace_once(
    root,
    "  const openRoom = key => {\n    window.location.hash = key;\n    setRoom(key);\n  };",
    "  const openRoom = key => {\n    if (appRoomKeys.has(key)) {\n      setCoreMounted(true);\n      setLastCoreRoom(key);\n    }\n    window.location.hash = key;\n    setRoom(key);\n  };",
    'Root openRoom',
)
root_tail_start = root.find("  if (room === 'vault') return roomShell")
if root_tail_start < 0:
    raise SystemExit('Root render tail: start marker not found')
root = root[:root_tail_start] + """  const coreActive = appRoomKeys.has(room);
  const coreView = coreActive ? room : lastCoreRoom;
  let foregroundRoom = null;

  if (room === 'vault') foregroundRoom = roomShell(<VaultPage onClose={goHome} />);
  else if (room === 'luze-room') foregroundRoom = roomShell(<LuzePrivateRoom onClose={goHome} />);
  else if (room === 'toybox') {
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
  }

  return (
    <>
      {room === 'home' && (
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
      )}

      {coreMounted && (
        <div
          data-ourhome-core-room={coreActive ? 'active' : 'parked'}
          style={{ display: coreActive ? 'contents' : 'none' }}
          aria-hidden={coreActive ? undefined : true}
        >
          <RoomBoundary room={coreView} onHome={goHome}>
            <Suspense fallback={<div className="room-loading-shell" role="status">正在打开房间…</div>}>
              <App initialView={coreView} onHome={goHome} />
              {coreActive && room === 'theater' && <TheaterRuleLibrary />}
              {coreActive && room === 'settings' && (
                <>
                  <ApiUsageLogPanel />
                  <LuzeAutonomySettingsPanel />
                </>
              )}
            </Suspense>
          </RoomBoundary>
        </div>
      )}

      {!coreActive && room !== 'home' && foregroundRoom}
    </>
  );
}
"""
root_path.write_text(root)


app_path = Path('src/App.jsx')
app = app_path.read_text()
app = replace_once(
    app,
    "  const [sessions, setSessions] = useState([]);\n  const listRef = useRef(null);\n  const chatStickToBottomRef = useRef(true);",
    "  const [sessions, setSessions] = useState([]);\n  const messageCacheRef = useRef(new Map());\n  const summaryCacheRef = useRef(new Map());\n  const draftCacheRef = useRef(new Map());\n  const listRef = useRef(null);\n  const chatStickToBottomRef = useRef(true);",
    'App cache refs',
)
load_pattern = re.compile(
    r"  const loadMessagesFor = \(id\) => \{.*?\n  \};\n\n  const generateCurrentSessionSummary",
    re.S,
)
load_replacement = """  const showCachedMessages = useCallback((id, { scroll = true } = {}) => {
    const key = String(id);
    const cached = messageCacheRef.current.get(key);
    if (!cached) return false;
    setMsgs(cached);
    setVisible(cached.length);
    setHasHistory(cached.length > 0);
    if (summaryCacheRef.current.has(key)) setSessionSummary(summaryCacheRef.current.get(key));
    if (scroll) scrollChatToBottomNow();
    return true;
  }, [scrollChatToBottomNow]);

  const loadMessagesFor = useCallback((id, { preferCache = true, scroll = true } = {}) => {
    const key = String(id);
    if (preferCache) showCachedMessages(id, { scroll });
    setSessionSummaryError('');
    return Promise.all([
      apiFetch(`${BACKEND}/sessions/${id}/messages`).then(r => r.json()),
      apiFetch(`${BACKEND}/sessions/${id}/summary`).then(r => r.json()).catch(() => null),
    ])
      .then(([data, summary]) => {
        const mapped = (Array.isArray(data) ? data : []).map(mapDbMessage);
        const nextSummary = summary && summary.id ? summary : null;
        messageCacheRef.current.set(key, mapped);
        summaryCacheRef.current.set(key, nextSummary);
        if (String(sessionIdRef.current) === key) {
          setMsgs(mapped);
          setVisible(mapped.length);
          setHasHistory(mapped.length > 0);
          setSessionSummary(nextSummary);
          if (scroll) scrollChatToBottomNow();
        }
        return mapped;
      });
  }, [scrollChatToBottomNow, showCachedMessages]);

  const generateCurrentSessionSummary"""
app, load_count = load_pattern.subn(load_replacement, app, count=1)
if load_count != 1:
    raise SystemExit(f'App loadMessagesFor: expected one block, found {load_count}')
app = replace_once(
    app,
    "        if (target) {\n          setSessionId(target.id);\n          localStorage.setItem(SESSION_KEY, target.id);",
    "        if (target) {\n          sessionIdRef.current = target.id;\n          setSessionId(target.id);\n          localStorage.setItem(SESSION_KEY, target.id);",
    'App initial session ref',
)
app = replace_once(
    app,
    "  }, []);\n\n  useEffect(() => {\n    if (locked) return undefined;\n    const handleServiceWorkerMessage",
    "  }, [loadMessagesFor]);\n\n  useEffect(() => {\n    if (locked) return undefined;\n    const handleServiceWorkerMessage",
    'App notification callback dependency',
)
switch_pattern = re.compile(
    r"  const switchSession = \(id\) => \{.*?\n  \};\n\n  const createSession = \(\) => \{",
    re.S,
)
switch_replacement = """  const saveDraftForSession = (id) => {
    if (id == null) return;
    const draft = editingMessage
      ? { input: editingMessage.draftBefore || '', pendingFile: editingMessage.pendingFileBefore || null }
      : { input, pendingFile };
    draftCacheRef.current.set(String(id), draft);
  };

  const restoreDraftForSession = (id) => {
    const draft = draftCacheRef.current.get(String(id));
    setInput(draft?.input || '');
    setPendingFile(draft?.pendingFile || null);
  };

  const switchSession = (id) => {
    if (String(id) === String(sessionId)) { setDrawerOpen(false); return; }
    saveDraftForSession(sessionId);
    setEditingMessage(null);
    setMessageAction(null);
    setRollbackUndo(null);
    setMessageActionError('');
    setTokenUsageOpen(false);
    chatStickToBottomRef.current = true;
    sessionIdRef.current = id;
    setSessionId(id);
    localStorage.setItem(SESSION_KEY, id);
    restoreDraftForSession(id);
    const cached = showCachedMessages(id);
    if (!cached) {
      setMsgs([]);
      setVisible(0);
      setHasHistory(false);
      setSessionSummary(null);
    }
    loadMessagesFor(id, { preferCache: false }).catch(console.error);
    setDrawerOpen(false);
  };

  const createSession = () => {"""
app, switch_count = switch_pattern.subn(switch_replacement, app, count=1)
if switch_count != 1:
    raise SystemExit(f'App switchSession: expected one block, found {switch_count}')
app = replace_once(
    app,
    "      .then(data => {\n        fetchSessions();\n        switchSession(data.id);\n        setMsgs([]);\n        setVisible(0);\n        setHasHistory(true);\n      })",
    "      .then(data => {\n        fetchSessions();\n        messageCacheRef.current.set(String(data.id), []);\n        summaryCacheRef.current.set(String(data.id), null);\n        draftCacheRef.current.set(String(data.id), { input: '', pendingFile: null });\n        switchSession(data.id);\n        setHasHistory(true);\n      })",
    'App create session cache',
)
app = replace_once(
    app,
    "      .then(() => {\n        fetchSessions();\n        if (id === sessionId) {",
    "      .then(() => {\n        messageCacheRef.current.delete(String(id));\n        summaryCacheRef.current.delete(String(id));\n        draftCacheRef.current.delete(String(id));\n        fetchSessions();\n        if (id === sessionId) {",
    'App delete session cache',
)
app = replace_once(
    app,
    "  const [rollbackUndo, setRollbackUndo] = useState(null);\n  const toggleThinking = (id) => setMsgs(ms => ms.map(m => m.id === id ? { ...m, thinkingOpen: !m.thinkingOpen } : m));",
    "  const [rollbackUndo, setRollbackUndo] = useState(null);\n\n  useEffect(() => {\n    if (!ready || sessionId == null || editingMessage) return;\n    draftCacheRef.current.set(String(sessionId), { input, pendingFile });\n  }, [editingMessage, input, pendingFile, ready, sessionId]);\n\n  useEffect(() => {\n    if (!ready || sessionId == null) return;\n    const key = String(sessionId);\n    messageCacheRef.current.set(key, msgs);\n    summaryCacheRef.current.set(key, sessionSummary);\n  }, [msgs, ready, sessionId, sessionSummary]);\n\n  const toggleThinking = (id) => setMsgs(ms => ms.map(m => m.id === id ? { ...m, thinkingOpen: !m.thinkingOpen } : m));",
    'App cache synchronization effects',
)
app = replace_once(
    app,
    "    if (r.session_id === sessionId) {\n      setPendingSearchJump(jump);\n    } else {\n      setSessionId(r.session_id);\n      localStorage.setItem(SESSION_KEY, r.session_id);\n      setPendingSearchJump(jump);\n      loadMessagesFor(r.session_id).catch(console.error);\n    }",
    "    if (String(r.session_id) === String(sessionId)) {\n      setPendingSearchJump(jump);\n    } else {\n      setPendingSearchJump(jump);\n      switchSession(r.session_id);\n    }",
    'App search session switch',
)
app_path.write_text(app)


test_path = Path('scripts/app-shell-regression.test.mjs')
tests = test_path.read_text()
tests = replace_once(
    tests,
    "const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, vault, offline, installSettings, gradle] = await Promise.all([",
    "const [manifestText, install, native, styles, finalHeaders, config, androidManifest, themeContext, root, app, vault, offline, installSettings, gradle] = await Promise.all([",
    'App test variable list',
)
tests = replace_once(
    tests,
    "  readFile(new URL('../src/Root.jsx', import.meta.url), 'utf8'),\n  readFile(new URL('../src/VaultPage.jsx', import.meta.url), 'utf8'),",
    "  readFile(new URL('../src/Root.jsx', import.meta.url), 'utf8'),\n  readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),\n  readFile(new URL('../src/VaultPage.jsx', import.meta.url), 'utf8'),",
    'App test source load',
)
tests += """

test('core rooms stay mounted in the background instead of rebuilding on every doorway', () => {
  assert.match(root, /const appRoomKeys = new Set/);
  assert.match(root, /coreMounted/);
  assert.match(root, /data-ourhome-core-room/);
  assert.match(root, /display: coreActive \? 'contents' : 'none'/);
  assert.doesNotMatch(root, /<App key=\{room\}/);
});

test('visited Chat sessions show cached history immediately and refresh in the background', () => {
  assert.match(app, /messageCacheRef = useRef\(new Map\(\)\)/);
  assert.match(app, /showCachedMessages/);
  assert.match(app, /loadMessagesFor\(id, \{ preferCache: false \}\)/);
  assert.match(app, /String\(sessionIdRef\.current\) === key/);
});

test('Chat keeps a separate unsent draft for every conversation', () => {
  assert.match(app, /draftCacheRef = useRef\(new Map\(\)\)/);
  assert.match(app, /saveDraftForSession/);
  assert.match(app, /restoreDraftForSession/);
  assert.match(app, /draftCacheRef\.current\.set\(String\(sessionId\), \{ input, pendingFile \}\)/);
});
"""
test_path.write_text(tests)

print('Prepared persistent core rooms, Chat cache, and per-session drafts.')
