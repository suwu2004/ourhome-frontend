import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useMusicPlayer } from './MusicPlayerContext.jsx';

const emptyTrack = {
  title: '',
  artist: '',
  album: '',
  audio_url: '',
  source_url: '',
  cover_url: '',
  lyrics: '',
  note: '',
};

const emptyQqTrack = { share_text: '', title: '', artist: '' };

function parseQqMusicShare(value) {
  const raw = String(value || '').trim();
  const url = raw.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),，。；;]+$/, '') || '';
  if (!url) return { valid: false, url: '', title: '', artist: '' };
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return { valid: false, url: '', title: '', artist: '' };
  }
  const valid = host === 'y.qq.com' || host.endsWith('.y.qq.com') || host === 'qqmusic.qq.com';
  const clean = raw
    .replace(url, '')
    .replace(/(?:分享歌曲|歌曲|QQ音乐|qq音乐|来QQ音乐听我喜欢的歌|打开QQ音乐)[：:]?/gi, ' ')
    .replace(/[《》“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = clean.split(/\s[-—·|]\s|\s{2,}/).map(item => item.trim()).filter(Boolean);
  return {
    valid,
    url,
    title: parts[0] || '',
    artist: parts[1] || '',
  };
}

function lyricText(track) {
  const text = String(track?.lyrics || track?.note || '').trim();
  if (!text) return '歌词还没有回来，先听一小段。';
  return text.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}

function parseLyricLines(track) {
  const raw = lyricText(track);
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  return lines.map(line => {
    const matches = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]+\]/g, '').trim();
    if (!matches.length) return { time: null, text: text || line };
    const match = matches[0];
    const fraction = match[3] ? Number(`0.${match[3].padEnd(3, '0').slice(0, 3)}`) : 0;
    return { time: Number(match[1]) * 60 + Number(match[2]) + fraction, text: text || line };
  });
}

function activeLyricIndex(lines, progress) {
  if (!lines.length) return 0;
  const currentTime = progress.currentTime || 0;
  let index = 0;
  lines.forEach((line, lineIndex) => {
    if (Number.isFinite(line.time) && line.time <= currentTime + 0.15) index = lineIndex;
  });
  return index;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function MusicRoom({ visible, theme, leaveRoom }) {
  const C = theme;
  const backgroundInputRef = useRef(null);
  const lyricsScrollRef = useRef(null);
  const lyricLineRefs = useRef([]);
  const {
    tracks,
    setTracks,
    state,
    activeTrack,
    loading,
    error,
    setError,
    loadMusic,
    updateState,
    selectTrack,
    togglePlay,
    playNext,
    playPrevious,
    progress,
    seekTo,
    toggleShuffle,
  } = useMusicPlayer();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [lyricsLoadingId, setLyricsLoadingId] = useState(null);
  const [tab, setTab] = useState('listen');
  const [qqDraft, setQqDraft] = useState(emptyQqTrack);

  useEffect(() => {
    if (visible) loadMusic();
  }, [visible]);

  const searchMusic = async event => {
    event?.preventDefault();
    const keyword = query.trim();
    if (!keyword) {
      setError('先写歌名、歌手，或者一句想听的歌。');
      return;
    }
    setSearching(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/music/search?q=${encodeURIComponent(keyword)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '没有搜到歌');
      setSearchResults(Array.isArray(data) ? data : []);
      if (!data.length) setError('这次没有搜到可试听的歌，换个歌名试试。');
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const saveTrackPayload = async payload => {
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/music/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '这首歌没有放进歌单');
      setTracks(items => [data, ...items]);
      if (!activeTrack) updateState({ track_id: data.id, is_playing: Boolean(data.audio_url) });
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const addSearchResult = async track => {
    const saved = await saveTrackPayload(track);
    if (saved) setSearchResults(items => items.filter(item => item.audio_url !== track.audio_url));
  };

  const updateQqShare = value => {
    const parsed = parseQqMusicShare(value);
    setQqDraft(current => ({
      share_text: value,
      title: current.title || parsed.title,
      artist: current.artist || parsed.artist,
    }));
    if (value.trim() && !parsed.valid) setError('请粘贴 QQ 音乐里“分享”复制出来的链接或整段文案。');
    else setError('');
  };

  const saveQqTrack = async () => {
    const parsed = parseQqMusicShare(qqDraft.share_text);
    if (!parsed.valid) {
      setError('还没有识别到 QQ 音乐链接。');
      return;
    }
    if (!qqDraft.title.trim()) {
      setError('再补一下歌名，就可以放进我们的歌单了。');
      return;
    }
    const saved = await saveTrackPayload({
      ...emptyTrack,
      title: qqDraft.title.trim(),
      artist: qqDraft.artist.trim(),
      source_url: parsed.url,
      note: 'QQ 音乐收藏',
    });
    if (saved) {
      setQqDraft(emptyQqTrack);
      setTab('library');
    }
  };

  const openSourceTrack = track => {
    if (!track?.source_url) return;
    window.open(track.source_url, '_blank', 'noopener,noreferrer');
  };

  const fillLyrics = async track => {
    if (!track?.id || !track.artist || !track.title) {
      setError('需要歌名和歌手才能找歌词。');
      return;
    }
    setLyricsLoadingId(track.id);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/music/lyrics?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.title)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '歌词没有回来');
      const nextTrack = { ...track, lyrics: data.lyrics || '' };
      const patch = await apiFetch(`${BACKEND}/music/tracks/${track.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextTrack),
      });
      const saved = await patch.json();
      if (!patch.ok) throw new Error(saved.error || '歌词没有保存好');
      setTracks(items => items.map(item => (item.id === saved.id ? saved : item)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLyricsLoadingId(null);
    }
  };

  const deleteTrack = async track => {
    if (!window.confirm(`从歌单里移除《${track.title || '未命名歌曲'}》吗？`)) return;
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/music/tracks/${track.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '删除失败');
      const nextTracks = tracks.filter(item => item.id !== track.id);
      setTracks(nextTracks);
      if (String(activeTrack?.id) === String(track.id)) {
        updateState({ track_id: nextTracks[0]?.id || null, is_playing: false });
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const uploadBackground = async file => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('背景要用图片文件。');
      return;
    }
    setBackgroundUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '背景没有上传成功');
      await updateState({ background_url: data.url });
    } catch (err) {
      setError(err.message);
    } finally {
      setBackgroundUploading(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = '';
    }
  };

  const progressMax = Math.max(progress.duration || 0, progress.currentTime || 0, 1);
  const playCardBackground = state.background_url
    ? {
        backgroundImage: `linear-gradient(145deg, rgba(255, 245, 177, .50), rgba(255, 253, 239, .74)), url(${state.background_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { background: `linear-gradient(180deg, ${C.white}, ${C.surface})` };
  const playMode = state.repeat_mode || (state.shuffle ? 'shuffle' : 'list');
  const playModeMeta = {
    list: { icon: '循', label: '列表循环' },
    one: { icon: '单', label: '单曲循环' },
    shuffle: { icon: '乱', label: '随机播放' },
    off: { icon: '顺', label: '顺序播放' },
  }[playMode] || { icon: '循', label: '列表循环' };
  const lyricLines = useMemo(() => parseLyricLines(activeTrack), [activeTrack?.id, activeTrack?.lyrics, activeTrack?.note]);
  const lyricsAreTimed = lyricLines.some(line => Number.isFinite(line.time));
  const activeLineIndex = activeLyricIndex(lyricLines, progress);

  useEffect(() => {
    if (!lyricsAreTimed) return;
    const node = lyricLineRefs.current[activeLineIndex];
    if (!node) return;
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeLineIndex, lyricsAreTimed]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity .4s ease', background: C.cream }}>
      <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 0, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10 }}>
          <button type="button" onClick={leaveRoom} aria-label="回到主页" style={{ border: 0, background: 'transparent', fontSize: 18, color: C.honeyDeep, cursor: 'pointer', padding: 4, fontFamily: 'inherit' }}>←</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '.05em' }}>一起听</div>
            <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: '.14em' }}>living room records</div>
          </div>
          <button type="button" onClick={loadMusic} disabled={loading} style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.honeyDeep, borderRadius: 999, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, cursor: loading ? 'default' : 'pointer' }}>{loading ? '翻找中' : '刷新'}</button>
        </div>
        <div role="tablist" aria-label="一起听页面" style={{ display: 'flex', gap: 0 }}>
          {[
            ['listen', '🎵 听歌'],
            ['search', '🔎 搜索'],
            ['qqmusic', 'QQ 音乐'],
            ['library', '💿 歌单'],
          ].map(([key, label]) => (
            <button
              type="button"
              role="tab"
              key={key}
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              style={{ flex: 1, border: 0, borderBottom: tab === key ? `2px solid ${C.honeyDeep}` : '2px solid transparent', background: 'transparent', color: tab === key ? C.honeyDeep : C.muted, fontSize: 11.5, fontWeight: tab === key ? 700 : 400, padding: '8px 0 10px', cursor: 'pointer', fontFamily: 'inherit' }}
            >{label}</button>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '16px min(18px, 4vw) 26px' }}>
        <section style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div role="alert" style={{ color: C.blushDeep, background: C.white, border: `1px solid ${C.border}`, borderRadius: 13, padding: '9px 11px', fontSize: 12 }}>{error}</div>}

          {tab === 'listen' && (
            <section style={{ minHeight: 'calc(100dvh - 212px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ position: 'relative', minHeight: 438, overflow: 'hidden', borderRadius: 24, border: `1px solid ${C.border}`, padding: '18px min(20px, 5vw) 22px', boxShadow: `0 18px 44px ${C.borderLight}aa`, display: 'flex', flexDirection: 'column', ...playCardBackground }}>
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(255, 247, 194, .26), rgba(255, 252, 238, .72)), radial-gradient(circle at 18% 10%, ${C.honeyLight}66, transparent 34%)`, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.mutedLight, fontSize: 10.5, letterSpacing: '.18em', marginBottom: 4 }}>NOW LISTENING</div>
                    <div style={{ color: C.text, fontSize: 24, fontWeight: 800, lineHeight: 1.22, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTrack?.title || '还没有选歌'}</div>
                    <div style={{ color: C.muted, fontSize: 12.5, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTrack?.artist || '先从 QQ 音乐收藏一首歌'}</div>
                    <div style={{ color: C.mutedLight, fontSize: 10.5, marginTop: 8 }}>{playModeMeta.label}</div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                    <input ref={backgroundInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => uploadBackground(event.target.files?.[0])} />
                    <button type="button" onClick={() => backgroundInputRef.current?.click()} disabled={backgroundUploading} style={{ border: 0, background: 'transparent', color: C.honeyDeep, fontSize: 11.5, padding: 0, fontFamily: 'inherit', cursor: backgroundUploading ? 'default' : 'pointer', textDecoration: 'underline', textUnderlineOffset: 3, opacity: backgroundUploading ? .58 : 1 }}>{backgroundUploading ? '上传中' : '换背景'}</button>
                  </div>
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginTop: 26 }}>
                  <div
                    ref={lyricsScrollRef}
                    style={{ maxHeight: 226, maxWidth: '82%', margin: '0 auto', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', color: C.muted, padding: '7px 2px', fontSize: 15.5, lineHeight: 1.86, textAlign: 'center', textShadow: `0 1px 8px ${C.white}` }}
                  >
                    {lyricLines.map((line, index) => (
                      <div
                        key={`${line.text}-${index}`}
                        ref={node => { lyricLineRefs.current[index] = node; }}
                        style={{ color: lyricsAreTimed && index === activeLineIndex ? C.honeyDeep : C.muted, fontSize: lyricsAreTimed && index === activeLineIndex ? 17 : 15.5, fontWeight: lyricsAreTimed && index === activeLineIndex ? 700 : 400, opacity: lyricsAreTimed && index === activeLineIndex ? 1 : .86, transition: 'color .25s ease, opacity .25s ease, font-size .25s ease', margin: '3px 0' }}
                      >
                        {line.text}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 'auto', paddingTop: 14 }}>
                  {activeTrack && <button type="button" onClick={() => fillLyrics(activeTrack)} disabled={lyricsLoadingId === activeTrack.id} style={{ ...softButtonStyle(C), padding: '7px 10px' }}>{lyricsLoadingId === activeTrack.id ? '找中' : '找歌词'}</button>}
                </div>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 12, paddingBottom: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ padding: '0 4px' }}>
                  <input
                    type="range"
                    min="0"
                    max={progressMax}
                    step="0.1"
                    value={Math.min(progress.currentTime || 0, progressMax)}
                    onChange={event => seekTo(Number(event.target.value))}
                    aria-label="播放进度"
                    style={{ width: '100%', accentColor: C.honeyDeep }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: C.mutedLight, fontSize: 11, marginTop: 2 }}>
                    <span>{formatTime(progress.currentTime)}</span>
                    <span>{formatTime(progress.duration)}</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 72px 1fr 1fr', alignItems: 'center', gap: 10, padding: '0 4px' }}>
                  <button type="button" onClick={toggleShuffle} aria-label={playModeMeta.label} title={playModeMeta.label} style={{ ...playerIconButtonStyle(C), color: C.honeyDeep, fontSize: 20 }}>{playModeMeta.icon}</button>
                  <button type="button" onClick={playPrevious} aria-label="上一首" style={playerIconButtonStyle(C)}>◀</button>
                  <button type="button" onClick={togglePlay} aria-label={state.is_playing ? '暂停' : '播放'} style={{ width: 72, height: 72, borderRadius: '50%', border: `2px solid ${C.text}`, background: C.surface, color: C.text, fontSize: 28, fontWeight: 800, display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: `0 10px 22px ${C.borderLight}` }}>{state.is_playing ? 'Ⅱ' : '▶'}</button>
                  <button type="button" onClick={playNext} aria-label="下一首" style={playerIconButtonStyle(C)}>▶</button>
                  <button type="button" onClick={() => setTab('library')} aria-label="打开歌单" style={playerIconButtonStyle(C)}>☰</button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" onClick={() => setTab('search')} style={{ border: 0, background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>去搜索</button>
                  <button type="button" onClick={() => setTab('qqmusic')} style={{ border: 0, background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>从 QQ 音乐收藏</button>
                </div>
              </div>
            </section>
          )}

          {tab === 'search' && (
            <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 9 }}>搜索区</div>
              <div style={{ color: C.mutedLight, fontSize: 10.5, lineHeight: 1.6, margin: '-3px 0 9px' }}>搜索区只用于试听与找歌；想保留完整歌曲，请从 QQ 音乐收藏。</div>
              <form onSubmit={searchMusic} style={{ display: 'flex', gap: 8 }}>
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="输入歌名、歌手，比如周杰伦 晴天" style={{ ...inputStyle(C), flex: 1, minWidth: 0 }} />
                <button type="submit" disabled={searching} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '0 15px', fontFamily: 'inherit', cursor: searching ? 'default' : 'pointer', opacity: searching ? .65 : 1 }}>{searching ? '搜着' : '搜索'}</button>
              </form>
              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {searchResults.map((track, index) => (
                    <div key={`${track.audio_url}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.borderLight}`, background: C.surface, borderRadius: 13, padding: '9px 10px' }}>
                      {track.cover_url && <img src={track.cover_url} alt="" style={{ width: 38, height: 38, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: C.text, fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                        <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[track.artist, track.album].filter(Boolean).join(' · ') || '试听片段'}</div>
                      </div>
                      <button type="button" onClick={() => addSearchResult(track)} disabled={saving} style={softButtonStyle(C)}>加入</button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'qqmusic' && (
            <section className="qq-music-import" style={{ border: `1px solid ${C.border}`, borderRadius: 18, background: C.white, padding: 15 }}>
              <div className="qq-music-import-head">
                <span aria-hidden="true">♫</span>
                <div>
                  <b style={{ color: C.text }}>从 QQ 音乐收藏</b>
                  <small style={{ color: C.muted }}>在 QQ 音乐点“分享 → 复制链接”，把整段内容粘贴到这里。</small>
                </div>
              </div>
              <textarea
                value={qqDraft.share_text}
                onChange={event => updateQqShare(event.target.value)}
                placeholder="粘贴 QQ 音乐分享文案或歌曲链接…"
                rows={4}
                style={{ ...inputStyle(C), width: '100%', marginTop: 14, borderRadius: 14, resize: 'vertical', lineHeight: 1.65 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 9, marginTop: 9 }}>
                <input value={qqDraft.title} onChange={event => setQqDraft(current => ({ ...current, title: event.target.value }))} placeholder="歌名" style={inputStyle(C)} />
                <input value={qqDraft.artist} onChange={event => setQqDraft(current => ({ ...current, artist: event.target.value }))} placeholder="歌手，可不填" style={inputStyle(C)} />
              </div>
              <div className="qq-music-import-note">收藏会留在我们的共同歌单里；播放时会安全唤起 QQ 音乐，会员权益仍由 QQ 音乐负责。</div>
              <button type="button" onClick={saveQqTrack} disabled={saving} style={{ marginTop: 12, border: 0, borderRadius: 999, background: 'linear-gradient(145deg, #31c27c, #20a968)', color: '#fff', padding: '9px 16px', fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer', opacity: saving ? .65 : 1 }}>{saving ? '收藏中' : '放进我们的歌单'}</button>
            </section>
          )}

          {tab === 'library' && (
            <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <b style={{ color: C.text }}>我们喜欢的音乐</b>
                <span style={{ color: C.mutedLight, fontSize: 11 }}>{tracks.length} 首</span>
              </div>
              {!tracks.length && <div style={{ color: C.muted, fontSize: 13, padding: '18px 0', textAlign: 'center' }}>还没有歌。去 QQ 音乐复制分享链接，放进我们的共同歌单。</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tracks.map(track => (
                  <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${String(activeTrack?.id) === String(track.id) ? C.honeyMid : C.borderLight}`, background: String(activeTrack?.id) === String(track.id) ? C.honeyLight : C.surface, borderRadius: 13, padding: '10px 11px' }}>
                    <button type="button" onClick={() => track.audio_url ? selectTrack(track) : openSourceTrack(track)} aria-label={track.audio_url ? `播放${track.title}` : `去 QQ 音乐播放${track.title}`} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.border}`, background: C.white, color: track.audio_url ? C.honeyDeep : '#20a968', cursor: 'pointer' }}>{track.audio_url && String(activeTrack?.id) === String(track.id) && state.is_playing ? 'Ⅱ' : track.audio_url ? '▶' : 'Q'}</button>
                    {track.cover_url && <img src={track.cover_url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.text, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                      <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[track.artist, track.album, track.note].filter(Boolean).join(' · ') || '没有备注'}</div>
                    </div>
                    {!track.lyrics && <button type="button" onClick={() => fillLyrics(track)} disabled={lyricsLoadingId === track.id} style={{ border: 'none', background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', cursor: 'pointer', fontSize: 11 }}>{lyricsLoadingId === track.id ? '找中' : '歌词'}</button>}
                    {track.source_url && <a href={track.source_url} target="_blank" rel="noreferrer" style={{ color: track.note === 'QQ 音乐收藏' ? '#20a968' : C.honeyDeep, fontSize: 11, flexShrink: 0 }}>{track.note === 'QQ 音乐收藏' ? 'QQ播放' : '原曲'}</a>}
                    <button type="button" onClick={() => deleteTrack(track)} style={{ border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', cursor: 'pointer', fontSize: 11 }}>删除</button>
                  </div>
                ))}
              </div>
            </section>
          )}

        </section>
      </main>
    </div>
  );
}

function inputStyle(C) {
  return {
    boxSizing: 'border-box',
    border: `1.5px solid ${C.border}`,
    borderRadius: 999,
    background: C.surface,
    color: C.text,
    padding: '9px 11px',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 13,
  };
}

function softButtonStyle(C) {
  return {
    border: `1px solid ${C.border}`,
    borderRadius: 999,
    background: C.surface,
    color: C.honeyDeep,
    padding: '8px 12px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
}

function playerIconButtonStyle(C) {
  return {
    width: '100%',
    minWidth: 0,
    height: 44,
    border: 0,
    background: 'transparent',
    color: C.text,
    fontSize: 24,
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
}
