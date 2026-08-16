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

theater = replaceOnce(
  theater,
  "import { MessageActionSheet } from './MessageActionSheet.jsx';",
  "import { MessageActionSheet } from './MessageActionSheet.jsx';\nimport { Stars } from './ChatDecorations.jsx';",
  'Stars import',
);

theater = replaceOnce(
  theater,
  "function Field({ label, hint, value, onChange, rows = 4, placeholder, theme }) {",
  `function TheaterAvatar({ isMe, src, theme }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, color: theme.white,
      background: isMe ? \`linear-gradient(150deg, #F2AFA2, \${theme.blushDeep})\` : \`linear-gradient(150deg, #E8B45A, \${theme.honeyDeep})\`,
      boxShadow: \`0 2px 6px \${isMe ? 'rgba(232,144,122,.3)' : 'rgba(185,122,31,.25)'}\`,
    }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (isMe ? '檀' : '泽')}
    </div>
  );
}

function Field({ label, hint, value, onChange, rows = 4, placeholder, theme }) {`,
  'Theater avatar helper',
);

theater = replaceOnce(
  theater,
  "export function TheaterRoom({ visible, theme, leaveRoom, selectedModel, availableModels = [], mainChatBackground = {} }) {",
  "export function TheaterRoom({ visible, theme, leaveRoom, selectedModel, availableModels = [], mainChatBackground = {}, myAvatar = '', partnerAvatar = '', myBubbleColor = '', partnerBubbleColor = '' }) {",
  'Theater visual props',
);

const newRenderChat = `  const renderChat = () => <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0 }}>
    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', ...theaterChatBackgroundStyle() }}>
      <div ref={chatScrollerRef} onScroll={handleChatScroll} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch', padding: '16px 14px 8px' }}>
        {messages.length === 0 && <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.8, padding: '30px 10px', textAlign: 'center' }}>这本书还没有开演。直接说从哪里开始就好。</div>}
        {messages.map((message, index) => {
          const isMe = message.role === 'user';
          const isLast = index === messages.length - 1;
          return <div key={message.id} style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 120px' }}>
            <div style={{ display: 'flex', marginBottom: 14, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
              <TheaterAvatar isMe={isMe} src={isMe ? myAvatar : partnerAvatar} theme={C} />
              <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ padding: '10px 14px', fontSize: 14.5, lineHeight: 1.72, color: C.text, borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? (myBubbleColor || C.blush) : (partnerBubbleColor || C.white), border: \`1px solid \${isMe ? '#F5CABB' : C.border}\`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</div>
                {!isMe && isLast && <button type="button" onClick={() => regenerateMessage(message)} disabled={chatting || Boolean(regeneratingMessageId) || messageActionLoading} style={{ border: 0, padding: '3px 0', background: 'transparent', fontSize: 10.5, color: C.muted, cursor: chatting || regeneratingMessageId ? 'default' : 'pointer', alignSelf: 'flex-start', fontFamily: 'inherit', opacity: chatting || regeneratingMessageId ? .55 : 1 }}>{String(regeneratingMessageId) === String(message.id) ? '重新生成中…' : '↻ 重新生成'}</button>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, color: C.mutedLight }}>{formatClock(message.created_at)}</span>
                <button type="button" onClick={() => openMessageActions(message)} disabled={chatting || messageActionLoading || Boolean(regeneratingMessageId)} aria-label="打开小剧场消息操作" title="编辑或回到这里" style={{ width: 40, height: 40, border: 0, borderRadius: 999, background: 'transparent', color: C.muted, cursor: chatting || messageActionLoading ? 'default' : 'pointer', opacity: .78, fontSize: 20, lineHeight: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 1, fontFamily: 'inherit' }}><span aria-hidden="true" style={{ transform: 'translateY(-2px)' }}>⌄</span></button>
              </div>
            </div>
          </div>;
        })}
        {chatting && <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 14 }}><TheaterAvatar isMe={false} src={partnerAvatar} theme={C} /><div style={{ padding: '10px 16px', borderRadius: '18px 18px 18px 4px', background: partnerBubbleColor || C.white, border: \`1px solid \${C.border}\`, fontSize: 12, color: C.muted, letterSpacing: '.12em', fontStyle: 'italic' }}>{editingMessage ? '正在按修改后的内容重新接戏…' : '穿越中…'}</div></div>}
        <div ref={chatEndRef} />
      </div>
    </div>

    <div className="ourhome-safe-bottom" style={{ background: C.white, borderTop: \`1px solid \${C.border}\`, paddingTop: 10, paddingLeft: 14, paddingRight: 14, flexShrink: 0 }}>
      {messages.length > 3 && !nearLatest && <div className="theater-latest-row" style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 2px 8px' }}><button type="button" onClick={() => scrollToLatest('smooth')} aria-label="跳到小剧场最新消息" style={{ border: \`1px solid \${C.border}\`, borderRadius: 999, background: C.white, color: C.honeyDeep, boxShadow: '0 4px 12px rgba(46,31,18,.14)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 11 }}>最新</button></div>}
      {editingMessage && <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 10px', borderRadius: 12, background: C.honeyLight, border: \`1px solid \${C.honeyMid}\` }}><div style={{ flex: 1, minWidth: 0 }}><div style={{ color: C.honeyDeep, fontSize: 11.5, fontWeight: 700 }}>正在重新编辑这条消息</div><div style={{ color: C.muted, fontSize: 10, marginTop: 2 }}>发送后会从这里重新接剧情，后面的 {editingMessage.afterCount} 条会收进旧分支。</div></div><button type="button" onClick={cancelEditMessage} disabled={messageActionLoading} style={{ flexShrink: 0, minWidth: 44, minHeight: 34, border: 0, borderRadius: 999, background: C.surface, color: C.muted, fontFamily: 'inherit', fontSize: 11 }}>取消</button></div>}
      {rollbackUndo && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 10px', borderRadius: 12, background: C.honeyLight, border: \`1px solid \${C.honeyMid}\` }}><span style={{ flex: 1, color: C.honeyDeep, fontSize: 11, lineHeight: 1.5 }}>已回到这里，收起了 {rollbackUndo.hiddenMessages.length} 条消息。</span><button type="button" onClick={undoRollback} disabled={messageActionLoading} style={{ minWidth: 52, minHeight: 34, border: \`1px solid \${C.honeyMid}\`, borderRadius: 999, background: C.white, color: C.honeyDeep, fontFamily: 'inherit', fontSize: 11, fontWeight: 700 }}>撤销</button></div>}
      {error && <div role="alert" style={{ marginBottom: 8, padding: '7px 10px', borderRadius: 10, background: 'rgba(214,120,104,.1)', color: C.blushDeep, fontSize: 10.5, lineHeight: 1.5 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: C.surface, border: \`1.5px solid \${editingMessage ? C.honey : C.border}\`, borderRadius: 22, padding: '6px 6px 6px 10px' }}><textarea value={chatInput} onChange={event => setChatInput(event.target.value)} rows={1} placeholder={editingMessage ? '修改好后重新发送…' : '在云端漫游'} style={{ flex: 1, maxHeight: 120, border: 'none', outline: 'none', background: 'transparent', color: C.text, resize: 'none', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.5, padding: '6px 0' }} /><button type="button" onClick={() => sendChat()} disabled={chatting || messageActionLoading || !chatInput.trim()} aria-label={editingMessage ? '重新发送修改后的小剧场消息' : '发送小剧场消息'} style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: chatInput.trim() && !chatting && !messageActionLoading ? \`linear-gradient(150deg, \${C.honey}, \${C.honeyDeep})\` : C.honeyMid, color: C.white, fontFamily: 'inherit', opacity: chatting || messageActionLoading ? .62 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↑</button></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 2 }}>{modelControl()}<button type="button" title={lastOutputTokens ? \`最近一轮生成 \${lastOutputTokens.toLocaleString('zh-CN')} tokens\` : '最近一轮上下文用量'} style={{ minWidth: 86, height: 26, flexShrink: 0, borderRadius: 999, border: \`1px solid \${C.border}\`, background: 'transparent', color: C.muted, padding: '0 9px', fontFamily: 'inherit', fontSize: 9.5, whiteSpace: 'nowrap' }}>◎ 上下文 {compactUsageNumber(lastContextTokens)}</button></div>
    </div>
  </main>;`;

theater = replaceRegexOnce(
  theater,
  /  const renderChat = \(\) => <main[\s\S]*?\n  <\/main>;\n\n  return <div/,
  `${newRenderChat}\n\n  return <div`,
  'Theater chat render block',
);

const newHeader = `    <header className="ourhome-safe-top theater-chat-header" style={{ background: C.white, borderBottom: \`1px solid \${C.border}\`, paddingLeft: 16, paddingRight: 16, flexShrink: 0 }}>
      <div className="theater-chat-header-row" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
        <div style={{ display: 'flex', gap: 5 }}><button type="button" onClick={selectedBook ? goBackToShelf : leaveRoom} aria-label={selectedBook ? '回到剧场书架' : '回到主页'} style={{ fontSize: 18, color: C.honeyDeep, background: 'transparent', border: 0, padding: 4, width: 30, height: 30, cursor: 'pointer' }}>←</button></div>
        <div className="theater-chat-header-title" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(58vw, 360px)', textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedBook ? selectedBook.title : '小剧场'}</div>
          <div style={{ fontSize: 10, color: chatting ? C.honey : C.muted, letterSpacing: '.12em', marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><div style={{ width: 5, height: 5, borderRadius: '50%', background: chatting ? C.honey : C.mutedLight, boxShadow: chatting ? \`0 0 5px \${C.honey}\` : 'none', transition: 'background .3s, box-shadow .3s' }} /><span>{selectedBook ? (bookPane === 'chat' ? (chatting ? '穿越中…' : '穿越平行时空') : '小剧场设定') : 'theater bookshelf'}</span></div>
        </div>
        <div className="theater-chat-header-actions" style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {selectedBook && bookPane === 'chat' && <button type="button" onClick={() => setBookPane('settings')} aria-label="打开小剧场设定" title="设定" style={{ fontSize: 20, lineHeight: 1, color: C.honeyDeep, background: C.honeyLight, border: \`1px solid \${C.honeyMid}\`, borderRadius: 10, width: 30, height: 30, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>♡</button>}
          <button type="button" onClick={loadBooks} disabled={loadingBooks} aria-label="刷新小剧场书架和消息" title="刷新小剧场书架和消息" style={{ fontSize: 19, lineHeight: 1, color: C.honeyDeep, background: C.honeyLight, border: \`1px solid \${C.honeyMid}\`, borderRadius: 10, width: 30, height: 30, padding: 0, cursor: loadingBooks ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: loadingBooks ? .55 : 1, fontFamily: 'Arial, sans-serif' }}>{loadingBooks ? '…' : '↻'}</button>
        </div>
      </div>
      <Stars theme={C} />
    </header>`;

theater = replaceRegexOnce(
  theater,
  /    <header className="ourhome-safe-top"[\s\S]*?<\/header>/,
  newHeader,
  'Theater formal Chat header',
);
write('src/TheaterRoomV2.jsx', theater);

let app = read('src/App.jsx');
app = replaceOnce(
  app,
  `        mainChatBackground={{ image: bgImage, color: bgColor || "#FDFAF5" }}\n      />`,
  `        mainChatBackground={{ image: bgImage, color: bgColor || "#FDFAF5" }}\n        myAvatar={myAvatar}\n        partnerAvatar={partnerAvatar}\n        myBubbleColor={myBubbleColor}\n        partnerBubbleColor={partnerBubbleColor}\n      />`,
  'Theater avatar and bubble props',
);
write('src/App.jsx', app);

let unified = read('src/UnifiedRoomHeaders.css');
unified = replaceOnce(
  unified,
  `body[data-ourhome-room="photos"] header.ourhome-safe-top > div,\nbody[data-ourhome-room="theater"] header.ourhome-safe-top > div {`,
  `body[data-ourhome-room="photos"] header.ourhome-safe-top > div {`,
  'Unified Theater title container override',
);
unified = replaceOnce(
  unified,
  `body[data-ourhome-room="photos"] header.ourhome-safe-top > div > div:first-child,\nbody[data-ourhome-room="theater"] header.ourhome-safe-top > div > div:first-child {`,
  `body[data-ourhome-room="photos"] header.ourhome-safe-top > div > div:first-child {`,
  'Unified Theater title child override',
);
unified = replaceOnce(
  unified,
  `body[data-ourhome-room="photos"] header.ourhome-safe-top > div > div:last-child,\nbody[data-ourhome-room="theater"] header.ourhome-safe-top > div > div:last-child {`,
  `body[data-ourhome-room="photos"] header.ourhome-safe-top > div > div:last-child {`,
  'Unified Theater subtitle override',
);
write('src/UnifiedRoomHeaders.css', unified);

let finalCss = read('src/RoomHeaderFinal.css');
finalCss = finalCss.replace('  [data-ourhome-room="theater"],\n', '');
finalCss = finalCss.replace('html[data-native-app="true"] body[data-ourhome-room="theater"] header.ourhome-safe-top > div,\n', '');
finalCss = finalCss.replace(`html[data-native-app="true"] body:is(\n  [data-ourhome-room="photos"],\n  [data-ourhome-room="theater"]\n) header.ourhome-safe-top > :last-child {`, `html[data-native-app="true"] body[data-ourhome-room="photos"] header.ourhome-safe-top > :last-child {`);
finalCss = finalCss.replace('body[data-ourhome-room="theater"] header.ourhome-safe-top > button:last-child,\n', '');
write('src/RoomHeaderFinal.css', finalCss);

let polish = read('src/RoomHeaderPolish.css');
polish = polish.replace('body[data-ourhome-room="music"] header.ourhome-safe-top > div:first-child > button:last-child,\nbody[data-ourhome-room="theater"] header.ourhome-safe-top > button:last-child {', 'body[data-ourhome-room="music"] header.ourhome-safe-top > div:first-child > button:last-child {');
polish = polish.replace('body[data-ourhome-room="music"] header.ourhome-safe-top > div:first-child > button:last-child::before,\nbody[data-ourhome-room="theater"] header.ourhome-safe-top > button:last-child::before {', 'body[data-ourhome-room="music"] header.ourhome-safe-top > div:first-child > button:last-child::before {');
polish = polish.replace('body[data-ourhome-room="music"] header.ourhome-safe-top > div:first-child > button:last-child:disabled::before,\nbody[data-ourhome-room="theater"] header.ourhome-safe-top > button:last-child:disabled::before {', 'body[data-ourhome-room="music"] header.ourhome-safe-top > div:first-child > button:last-child:disabled::before {');
write('src/RoomHeaderPolish.css', polish);

let test = read('scripts/theater-chat-ux-regression.test.mjs');
test += `\n\ntest('theater Chat mirrors the formal Chat header, bubbles and composer', () => {\n  assert.match(source, /import \\{ Stars \\} from '\\.\\/ChatDecorations\\.jsx'/);\n  assert.match(source, /穿越平行时空/);\n  assert.match(source, />♡<\\/button>/);\n  const heartIndex = source.indexOf('>♡</button>');\n  const refreshIndex = source.indexOf('aria-label=\"刷新小剧场书架和消息\"');\n  assert.ok(heartIndex > 0 && refreshIndex > heartIndex);\n  assert.match(source, /<Stars theme=\\{C\\} \\/>/);\n  assert.match(source, /TheaterAvatar/);\n  assert.match(source, /maxWidth: '72%'/);\n  assert.match(source, /18px 18px 4px 18px/);\n  assert.match(source, /className=\"ourhome-safe-bottom\"/);\n  assert.match(source, /myBubbleColor \\|\\| C\\.blush/);\n  assert.match(source, /partnerBubbleColor \\|\\| C\\.white/);\n});\n`;
write('scripts/theater-chat-ux-regression.test.mjs', test);

unlinkSync('scripts/apply-theater-chat-parity.mjs');
unlinkSync('.github/workflows/apply-theater-chat-parity.yml');
console.log('Applied formal Chat parity to Theater chat.');
