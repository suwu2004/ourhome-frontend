import { useEffect, useRef, useState } from 'react';
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

function formatTrack(track) {
  if (!track) return '还没有选歌';
  return [track.title, track.artist].filter(Boolean).join(' · ') || '未命名歌曲';
}

function lyricPreview(track) {
  const text = String(track?.lyrics || track?.note || '').trim();
  if (!text) return '歌词还没有回来，先听一小段。';
  return text.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function MusicRoom({ visible, theme, leaveRoom }) {
  const C = theme;
  const fileInputRef = useRef(null);
  const backgroundInputRef = useRef(null);
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
  const [draft, setDraft] = useState(emptyTrack);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [backgroundUploading, setBackgroundUploading] = useState(false);
  const [lyricsLoadingId, setLyricsLoadingId] = useState(null);
  const [tab, setTab] = useState('listen');

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

  const saveTrack = async () => {
    if (!draft.title.trim() && !draft.audio_url.trim() && !draft.source_url.trim()) {
      setError('至少写歌名，或者上传一段音频。');
      return;
    }
    const saved = await saveTrackPayload(draft);
    if (saved) setDraft(emptyTrack);
  };

  const addSearchResult = async track => {
    const saved = await saveTrackPayload(track);
    if (saved) setSearchResults(items => items.filter(item => item.audio_url !== track.audio_url));
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

  const uploadAudio = async file => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setError('这个文件不像音频，换一首歌试试。');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '音频没有上传成功');
      setDraft(current => ({
        ...current,
        audio_url: data.url,
        title: current.title || data.name?.replace(/\.[^.]+$/, '') || '',
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const patchTrack = async nextTrack => {
    if (!nextTrack?.id) {
      setError('先选一首歌，再换背景。');
      return null;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/music/tracks/${nextTrack.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextTrack),
      });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || '歌曲没有保存好');
      setTracks(items => items.map(item => (item.id === saved.id ? saved : item)));
      return saved;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const uploadBackground = async file => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('背景要用图片文件。');
      return;
    }
    if (!activeTrack) {
      setError('先选一首歌，再换背景。');
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
      await patchTrack({ ...activeTrack, cover_url: data.url });
    } catch (err) {
      setError(err.message);
    } finally {
      setBackgroundUploading(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = '';
    }
  };

  const progressMax = Math.max(progress.duration || 0, progress.currentTime || 0, 1);
  const coverArt = activeTrack?.cover_url
    ? { backgroundImage: `url(${activeTrack.cover_url})` }
    : { background: `linear-gradient(145deg, ${C.honeyLight}, ${C.white})` };
  const playCardBackground = activeTrack?.cover_url
    ? {
        backgroundImage: `linear-gradient(145deg, rgba(255, 245, 177, .46), rgba(255, 253, 239, .70)), url(${activeTrack.cover_url})`,
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
            ['library', '💿 歌单'],
            ['upload', '⬆ 上传'],
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
            <section style={{ minHeight: 'calc(100dvh - 250px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ position: 'relative', minHeight: 438, overflow: 'hidden', borderRadius: 24, border: `1px solid ${C.border}`, padding: '18px min(20px, 5vw) 22px', boxShadow: `0 18px 44px ${C.borderLight}aa`, display: 'flex', flexDirection: 'column', ...playCardBackground }}>
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(255, 247, 194, .26), rgba(255, 252, 238, .72)), radial-gradient(circle at 18% 10%, ${C.honeyLight}66, transparent 34%)`, pointerEvents: 'none' }} />
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '96px minmax(0, 1fr)', gap: 14, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <button type="button" onClick={togglePlay} aria-label={state.is_playing ? '暂停' : '播放'} style={{ width: 96, height: 96, borderRadius: 18, border: `1px solid ${C.border}`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: `0 14px 28px ${C.borderLight}`, ...coverArt }}>
                      <span style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `${C.white}cc`, color: C.honeyDeep, fontSize: 20, boxShadow: `0 6px 16px ${C.borderLight}` }}>{state.is_playing ? 'Ⅱ' : '▶'}</span>
                    </button>
                    <input ref={backgroundInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => uploadBackground(event.target.files?.[0])} />
                    <button type="button" onClick={() => backgroundInputRef.current?.click()} disabled={backgroundUploading || !activeTrack} style={{ position: 'absolute', left: 6, right: 6, bottom: 6, border: `1px solid ${C.border}`, borderRadius: 999, background: `${C.white}e6`, color: C.honeyDeep, fontSize: 10, padding: '4px 0', fontFamily: 'inherit', cursor: backgroundUploading || !activeTrack ? 'default' : 'pointer', opacity: backgroundUploading || !activeTrack ? .58 : 1 }}>{backgroundUploading ? '上传中' : '换背景'}</button>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.mutedLight, fontSize: 10.5, letterSpacing: '.18em', marginBottom: 4 }}>NOW LISTENING</div>
                    <div style={{ color: C.text, fontSize: 24, fontWeight: 800, lineHeight: 1.22, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTrack?.title || '还没有选歌'}</div>
                    <div style={{ color: C.muted, fontSize: 12.5, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTrack?.artist || '先去搜索或上传一首歌'}</div>
                    <div style={{ color: C.mutedLight, fontSize: 10.5, marginTop: 8 }}>{playModeMeta.label}</div>
                  </div>
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '82%', marginLeft: 'auto' }}>
                    <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.honeyLight, color: C.honeyDeep, flexShrink: 0 }}>✦</span>
                    <div style={{ maxHeight: 176, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', borderRadius: 14, background: `${C.white}df`, color: C.muted, padding: '10px 15px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'left', boxShadow: `0 10px 24px ${C.borderLight}66` }}>{lyricPreview(activeTrack)}</div>
                  </div>
                </div>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 14 }}>
                  {activeTrack && <button type="button" onClick={() => fillLyrics(activeTrack)} disabled={lyricsLoadingId === activeTrack.id} style={{ ...softButtonStyle(C), padding: '7px 10px' }}>{lyricsLoadingId === activeTrack.id ? '找中' : '找歌词'}</button>}
                  {activeTrack?.source_url && <a href={activeTrack.source_url} target="_blank" rel="noreferrer" style={{ color: C.honeyDeep, fontSize: 12 }}>打开原曲链接</a>}
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
                  <button type="button" onClick={() => setTab('upload')} style={{ border: 0, background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>上传音频</button>
                </div>
              </div>
            </section>
          )}

          {tab === 'search' && (
            <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 9 }}>搜索区</div>
              <div style={{ color: C.mutedLight, fontSize: 10.5, lineHeight: 1.6, margin: '-3px 0 9px' }}>搜索到的是官方试听片段，通常只有 30 秒；想听完整音频，可以到“上传”里放自己的音乐文件。</div>
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

          {tab === 'library' && (
            <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <b style={{ color: C.text }}>我们喜欢的音乐</b>
                <span style={{ color: C.mutedLight, fontSize: 11 }}>{tracks.length} 首</span>
              </div>
              {!tracks.length && <div style={{ color: C.muted, fontSize: 13, padding: '18px 0', textAlign: 'center' }}>还没有歌。去“搜索”找一首，或者去“上传”放进唱片机。</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tracks.map(track => (
                  <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${String(activeTrack?.id) === String(track.id) ? C.honeyMid : C.borderLight}`, background: String(activeTrack?.id) === String(track.id) ? C.honeyLight : C.surface, borderRadius: 13, padding: '10px 11px' }}>
                    <button type="button" onClick={() => selectTrack(track)} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.border}`, background: C.white, color: C.honeyDeep, cursor: 'pointer' }}>{String(activeTrack?.id) === String(track.id) && state.is_playing ? 'Ⅱ' : '▶'}</button>
                    {track.cover_url && <img src={track.cover_url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.text, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                      <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[track.artist, track.album, track.note].filter(Boolean).join(' · ') || '没有备注'}</div>
                    </div>
                    {!track.lyrics && <button type="button" onClick={() => fillLyrics(track)} disabled={lyricsLoadingId === track.id} style={{ border: 'none', background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', cursor: 'pointer', fontSize: 11 }}>{lyricsLoadingId === track.id ? '找中' : '歌词'}</button>}
                    {track.source_url && <a href={track.source_url} target="_blank" rel="noreferrer" style={{ color: C.honeyDeep, fontSize: 11, flexShrink: 0 }}>原曲</a>}
                    <button type="button" onClick={() => deleteTrack(track)} style={{ border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', cursor: 'pointer', fontSize: 11 }}>删除</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'upload' && (
            <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
              <div style={{ color: C.text, fontWeight: 700, marginBottom: 9 }}>手动收藏 / 上传音频</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9 }}>
                <input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="歌名" style={inputStyle(C)} />
                <input value={draft.artist} onChange={event => setDraft(current => ({ ...current, artist: event.target.value }))} placeholder="歌手" style={inputStyle(C)} />
                <input value={draft.album} onChange={event => setDraft(current => ({ ...current, album: event.target.value }))} placeholder="专辑，可不填" style={inputStyle(C)} />
              </div>
              <input value={draft.audio_url} onChange={event => setDraft(current => ({ ...current, audio_url: event.target.value }))} placeholder="可直接播放的音频链接，上传后自动填入" style={{ ...inputStyle(C), width: '100%', marginTop: 9 }} />
              <input value={draft.cover_url} onChange={event => setDraft(current => ({ ...current, cover_url: event.target.value }))} placeholder="封面 / 背景图链接，可不填" style={{ ...inputStyle(C), width: '100%', marginTop: 9 }} />
              <textarea value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} placeholder="备注或想显示在唱片机上的一句话……" rows={2} style={{ ...inputStyle(C), width: '100%', resize: 'vertical', marginTop: 9, borderRadius: 12 }} />
              <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={event => uploadAudio(event.target.files?.[0])} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={softButtonStyle(C)}>{uploading ? '上传中' : '上传音频'}</button>
                <button type="button" onClick={saveTrack} disabled={saving} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '9px 15px', fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer', opacity: saving ? .65 : 1 }}>{saving ? '保存中' : '加入歌单'}</button>
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
