import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, value) { writeFileSync(path, value, 'utf8'); }
function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing transform target: ${label}`);
  return source.replace(search, replacement);
}
function replaceRegexOnce(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Missing regex transform target: ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

let theater = read('src/TheaterRoomV2.jsx');

theater = replaceRegexOnce(
  theater,
  /  const renderChat = \(\) => <main[\s\S]*?\n      <div ref=\{chatScrollerRef\}/,
  `  const renderChat = () => <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0 }}>
    <div style={{ flex: 1, minHeight: 0, width: '100%', margin: 0, ...theaterChatBackgroundStyle(), padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div ref={chatScrollerRef}`,
  'Theater full-width chat shell',
);

theater = replaceOnce(theater, '>↓ 最新</button>', '>最新</button>', 'latest label');
theater = replaceOnce(theater, "'在小剧场里说话、下导演指令、继续剧情……'", "'在云端漫游'", 'Theater placeholder');
theater = replaceOnce(theater, "`${assistantDisplayName} · ${model || '默认模型'}`", '`${assistantDisplayName}`', 'header model subtitle');
theater = replaceOnce(
  theater,
  "marginTop: settings ? 10 : 0 }}>",
  "marginTop: settings ? 10 : 0, flex: settings ? '1 1 100%' : '1 1 auto', minWidth: 0 }}>",
  'Theater model control flex',
);
theater = replaceOnce(
  theater,
  "fontFamily: 'inherit', opacity: modelsLoading ? .55 : 1 }}",
  "fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, opacity: modelsLoading ? .55 : 1 }}",
  'Theater model refresh centering',
);
theater = replaceOnce(
  theater,
  "fontFamily: 'inherit', fontSize: 15, opacity: loadingBooks ? .55 : 1 }}",
  "fontFamily: 'inherit', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, opacity: loadingBooks ? .55 : 1 }}",
  'Theater header refresh centering',
);
theater = replaceRegexOnce(
  theater,
  /(<button type="button" onClick=\{loadBooks\}[\s\S]*?<\/button>)<\/header>/,
  `$1{selectedBook && bookPane === 'chat' && <button type="button" onClick={() => setBookPane('settings')} aria-label="打开小剧场设定" title="设定" style={{ width: 32, height: 32, border: \`1px solid \${C.border}\`, background: C.surface, color: C.honeyDeep, borderRadius: '50%', fontFamily: 'inherit', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1 }}>⚙</button>}</header>`,
  'Theater header settings icon',
);
write('src/TheaterRoomV2.jsx', theater);

let chat = read('src/ChatRoom.jsx');
chat = replaceOnce(chat, '"在云端漫步"', '"在云端漫游"', 'main Chat placeholder');
chat = replaceOnce(
  chat,
  "fontFamily: 'inherit', opacity: modelsLoading ? .55 : 1 }}",
  "fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, lineHeight: 1, opacity: modelsLoading ? .55 : 1 }}",
  'main Chat model refresh centering',
);
write('src/ChatRoom.jsx', chat);

let home = read('src/HomeHub.jsx');
home = replaceOnce(
  home,
  'function ReadingIcon() {',
  `function DrawingIcon() {
  return (
    <svg className="home-room-glyph" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M9 27 24.8 11.2l4 4L13 31H9v-4Z" />
      <path d="m22.8 13.2 4 4M25.8 10.2l2-2a2.6 2.6 0 0 1 3.7 0l.3.3a2.6 2.6 0 0 1 0 3.7l-2 2" />
      <path d="M8 9h10M8 14h7" />
    </svg>
  );
}

function ReadingIcon() {`,
  'Drawing icon',
);
home = replaceRegexOnce(
  home,
  /(\s*<button className="home-room-app home-room-app--photos"[\s\S]*?<\/button>)/,
  `$1
            <button className="home-room-app home-room-app--drawing" type="button" onClick={() => onOpen('drawing')} aria-label="打开画画">
              <span><DrawingIcon /><HomeCatFrame /></span>
              <strong>画画</strong>
            </button>`,
  'Drawing home entry',
);
write('src/HomeHub.jsx', home);

let grid = read('src/HomeRoomGrid.css');
grid = grid.replace('/* 八个小功能：', '/* 九个小功能：');
grid = replaceOnce(grid, '    ". toybox luze" !important;', '    "drawing toybox luze" !important;', 'drawing grid area');
grid = replaceOnce(grid, '.home-scene .home-music-garden .home-room-app--photos,\n.home-scene .home-music-garden .home-room-app--reading,', '.home-scene .home-music-garden .home-room-app--photos,\n.home-scene .home-music-garden .home-room-app--drawing,\n.home-scene .home-music-garden .home-room-app--reading,', 'drawing app selector');
grid = replaceOnce(grid, '.home-scene .home-music-garden .home-room-app--photos { grid-area: photos !important; }', '.home-scene .home-music-garden .home-room-app--photos { grid-area: photos !important; }\n.home-scene .home-music-garden .home-room-app--drawing { grid-area: drawing !important; }', 'drawing grid rule');
grid = replaceOnce(grid, '.home-scene .home-room-app--toybox { animation-delay: .66s !important; }', '.home-scene .home-room-app--drawing { animation-delay: .66s !important; }\n.home-scene .home-room-app--toybox { animation-delay: .72s !important; }', 'drawing animation delay');
grid = replaceOnce(grid, '.home-scene .home-room-app--luze { animation-delay: .72s !important; }', '.home-scene .home-room-app--luze { animation-delay: .78s !important; }', 'luze animation delay');
grid = replaceOnce(grid, '.home-scene .home-room-app--toybox > span { animation-delay: -10.1s !important; }', '.home-scene .home-room-app--drawing > span { animation-delay: -6.6s !important; }\n.home-scene .home-room-app--toybox > span { animation-delay: -10.1s !important; }', 'drawing idle delay');
write('src/HomeRoomGrid.css', grid);

let root = read('src/Root.jsx');
root = replaceOnce(root, "const VaultPage = lazy(() => import('./VaultPage.jsx'));", "const VaultPage = lazy(() => import('./VaultPage.jsx'));\nconst DrawingRoom = lazy(() => import('./DrawingRoom.jsx'));", 'Drawing lazy import');
root = replaceOnce(root, "'vault', 'photos', 'settings', 'toybox', 'luze-room'", "'vault', 'photos', 'settings', 'toybox', 'luze-room', 'drawing'", 'Drawing room key');
root = replaceOnce(root, "  if (room === 'vault') {", "  if (room === 'drawing') {\n    foregroundRoom = roomShell(<DrawingRoom onClose={goHome} />);\n  } else if (room === 'vault') {", 'Drawing route');
write('src/Root.jsx', root);

let theaterTest = read('scripts/theater-chat-ux-regression.test.mjs');
theaterTest = replaceOnce(
  theaterTest,
  "  assert.match(source, /\\$\\{assistantDisplayName\\} · \\$\\{model \\|\\| '默认模型'\\}/);",
  "  assert.doesNotMatch(source, /\\$\\{assistantDisplayName\\} · \\$\\{model \\|\\| '默认模型'\\}/);\n  assert.match(source, /aria-label=\"打开小剧场设定\"/);",
  'Theater header regression expectation',
);
theaterTest = replaceOnce(
  theaterTest,
  "  assert.ok(composerIndex > latestIndex);",
  "  assert.ok(composerIndex > latestIndex);\n  assert.match(source, />最新<\\/button>/);\n  assert.doesNotMatch(source, />↓ 最新<\\/button>/);",
  'latest button regression expectation',
);
theaterTest += `\n\ntest('theater composer matches main Chat width and cloud-wandering placeholder', () => {\n  const chatStart = source.indexOf('const renderChat =');\n  const chatSlice = source.slice(chatStart);\n  assert.match(chatSlice, /padding: 0/);\n  assert.doesNotMatch(chatSlice.slice(0, 1200), /maxWidth: 760/);\n  assert.match(source, /'在云端漫游'/);\n  assert.doesNotMatch(source, /互动推进.*最低/);\n});\n`;
write('scripts/theater-chat-ux-regression.test.mjs', theaterTest);

let pkg = read('package.json');
pkg = replaceOnce(pkg, 'scripts/theater-chat-ux-regression.test.mjs scripts/theater-rule-scope-regression.test.mjs', 'scripts/theater-chat-ux-regression.test.mjs scripts/drawing-room-regression.test.mjs scripts/theater-rule-scope-regression.test.mjs', 'drawing regression in app suite');
write('package.json', pkg);

unlinkSync('scripts/apply-theater-drawing-polish.mjs');
unlinkSync('.github/workflows/apply-theater-drawing-polish.yml');
console.log('Applied Theater / Chat polish and wired the Drawing room.');
