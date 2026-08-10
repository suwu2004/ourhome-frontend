from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

path = Path('src/TheaterRoom.jsx')
text = path.read_text()

old = """  const openBook = (bookId, pane = 'settings') => {
    setSelectedBookId(bookId);
    setBookPane(pane);
    setError('');
  };
"""
new = """  const openBook = (bookId, pane = null) => {
    const book = books.find(item => String(item.id) === String(bookId));
    const settings = normalizeDraftSettings(book?.settings || {});
    const hasWorldSetup = Boolean(
      settings.worldbook_text.trim()
      || settings.premise.trim()
      || settings.characters.trim()
      || settings.rules.trim()
    );
    const hasStory = Boolean((book?.messages || []).length || Number(book?.message_count) > 0);
    setSelectedBookId(bookId);
    setBookPane(pane || ((hasWorldSetup || hasStory) ? 'chat' : 'settings'));
    setError('');
  };
"""
text = replace_once(text, old, new, 'auto-open existing worlds in chat')

old = """          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-end', flexShrink: 0, maxWidth: '52%' }}>
            <button type=\"button\" onClick={() => setBookPane('settings')} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.honeyDeep, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>设定</button>
            <select value={model} onChange={event => setModel(event.target.value)} style={{ width: 'min(230px, 48vw)', border: `1px solid ${C.border}`, background: C.surface, color: C.muted, borderRadius: 999, padding: '7px 10px', fontFamily: 'inherit', fontSize: 10.5 }}>
              {modelOptions.length ? modelOptions.map(item => <option key={item} value={item}>{item}</option>) : <option value=\"\">默认模型</option>}
            </select>
          </div>
"""
new = """          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button type=\"button\" onClick={() => setBookPane('settings')} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.honeyDeep, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>设定</button>
          </div>
"""
text = replace_once(text, old, new, 'remove header model selector')

old = """          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 8, border: `1.5px solid ${C.border}`, borderRadius: 20, background: C.surface, padding: '7px 7px 7px 10px' }}>
            <textarea value={chatInput} onChange={event => setChatInput(event.target.value)} rows={1} placeholder=\"在小剧场里说话、下导演指令、继续剧情……\" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: C.text, resize: 'none', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.6, padding: '5px 0' }} />
            <button type=\"button\" onClick={() => sendChat()} disabled={chatting || !chatInput.trim()} style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: chatInput.trim() && !chatting ? `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontFamily: 'inherit', cursor: chatInput.trim() && !chatting ? 'pointer' : 'default' }}>↑</button>
          </div>
"""
new = """          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, border: `1.5px solid ${C.border}`, borderRadius: 20, background: C.surface, padding: '7px 7px 7px 10px' }}>
              <textarea value={chatInput} onChange={event => setChatInput(event.target.value)} rows={1} placeholder=\"在小剧场里说话、下导演指令、继续剧情……\" style={{ flex: 1, maxHeight: 120, border: 'none', outline: 'none', background: 'transparent', color: C.text, resize: 'none', fontFamily: 'inherit', fontSize: 14.5, lineHeight: 1.5, padding: '6px 0' }} />
              <button type=\"button\" onClick={() => sendChat()} disabled={chatting || !chatInput.trim()} aria-label=\"发送小剧场消息\" style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: chatInput.trim() && !chatting ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontFamily: 'inherit', cursor: chatInput.trim() && !chatting ? 'pointer' : 'default', boxShadow: chatInput.trim() && !chatting ? '0 3px 10px rgba(185,122,31,.35)' : 'none', opacity: chatting ? .62 : 1 }}>↑</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 2 }}>
              <select aria-label=\"选择小剧场模型\" value={model} onChange={event => setModel(event.target.value)} style={{ flex: 1, minWidth: 0, fontSize: 11, color: C.muted, background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 999, padding: '4px 10px', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {modelOptions.length ? modelOptions.map(item => <option key={item} value={item}>{item}</option>) : <option value=\"\">暂无可用模型</option>}
              </select>
              <span style={{ color: C.mutedLight, fontSize: 10, whiteSpace: 'nowrap' }}>{mode === 'interactive' ? '互动推进' : '沉浸纯文'}</span>
            </div>
          </div>
"""
text = replace_once(text, old, new, 'align theater composer with main chat')
path.write_text(text)

pkg_path = Path('package.json')
pkg = pkg_path.read_text()
old_script = 'scripts/android-update-progress-regression.test.mjs scripts/font-loading-regression.test.mjs scripts/settings-lazy-mount-regression.test.mjs'
if old_script not in pkg:
    raise SystemExit('package test:app anchor missing')
pkg = pkg.replace(old_script, old_script + ' scripts/theater-chat-ux-regression.test.mjs', 1)
pkg_path.write_text(pkg)

test_path = Path('scripts/theater-chat-ux-regression.test.mjs')
test_path.write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/TheaterRoom.jsx', import.meta.url), 'utf8');

test('existing configured theater worlds open directly into chat', () => {
  assert.match(source, /hasWorldSetup/);
  assert.match(source, /hasStory/);
  assert.match(source, /setBookPane\(pane \|\| \(\(hasWorldSetup \|\| hasStory\) \? 'chat' : 'settings'\)\)/);
  assert.match(source, /setBookPane\('settings'\)/); // new blank worlds still start in setup
});

test('theater model selector lives with the composer like main Chat', () => {
  const composerIndex = source.indexOf('发送小剧场消息');
  const modelIndex = source.indexOf('选择小剧场模型');
  const settingsIndex = source.indexOf("onClick={() => setBookPane('settings')}");
  assert.ok(composerIndex > 0);
  assert.ok(modelIndex > composerIndex);
  assert.ok(settingsIndex > 0 && settingsIndex < composerIndex);
});
""")
