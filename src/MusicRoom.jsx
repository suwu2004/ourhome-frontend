import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';

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
  return text.split('\n').map(line => line.trim()).filter(Boolean).slice(0, 4).join('\n');
}

export function MusicRoom({ visible, theme, leaveRoom }) {
  const C = theme;
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tracks, setTracks] = useState([]);
  const [state, setState] = useState({ track_id: null, is_playing: false, shuffle: false });
  const [draft, setDraft] = useState(emptyTrack);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lyricsLoadingId, setLyricsLoadingId] = useState(null);
  const [error, setError] = useState('');

  const activeTrack = useMemo(
    () => tracks.find(track => String(track.id) === String(state.track_id)) || tracks[0] || null,
    [tracks, state.track_id],
  );

  const updateState = async patch => {
    const next = { ...state, ...patch, updated_at: new Date().toISOString() };
    setState(next);
    try {
      await apiFetch(`${BACKEND}/music/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch (err) {
      console.error('保存一起听状态失败', err);
    }
  };

  const loadMusic = async () => {
    setLoading(true);
    setError('');
    try {
      const [tracksResponse, stateResponse] = await Promise.all([
        apiFetch(`${BACKEND}/music/tracks`),
        apiFetch(`${BACKEND}/music/state`),
      ]);
      const tracksData = await tracksResponse.json();
      const stateData = await stateResponse.json();
      if (!tracksResponse.ok) throw new Error(tracksData.error || '歌单没有回来');
      if (!stateResponse.ok) throw new Error(stateData.error || '播放状态没有回来');
      setTracks(Array.isArray(tracksData) ? tracksData : []);
      setState({ track_id: null, is_playing: false, shuffle: false, ...(stateData || {}) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) loadMusic();
  }, [visible]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (activeTrack?.audio_url) audioRef.current.src = activeTrack.audio_url;
    if (state.is_playing && activeTrack?.audio_url) {
      audioRef.current.play().catch(() => updateState({ is_playing: false }));
    } else {
      audioRef.current.pause();
    }
  }, [activeTrack?.id, activeTrack?.audio_url, state.is_playing]);

  const pickTrack = (direction = 1) => {
    if (!tracks.length) return null;
    if (state.shuffle && tracks.length > 1) {
      const candidates = tracks.filter(track => String(track.id) !== String(activeTrack?.id));
      return candidates[Math.floor(Math.random() * candidates.length)] || tracks[0];
    }
    const index = Math.max(0, tracks.findIndex(track => String(track.id) === String(activeTrack?.id)));
    return tracks[(index + direction + tracks.length) % tracks.length];
  };

  const selectTrack = track => {
    updateState({ track_id: track.id, is_playing: Boolean(track.audio_url) });
  };

  const togglePlay = () => {
    if (!activeTrack?.audio_url) {
      setError(activeTrack ? '这首歌没有可直接播放的试听，换一首搜到的歌试试。' : '先搜一首歌放进歌单。');
      return;
    }
    updateState({ track_id: activeTrack.id, is_playing: !state.is_playing });
  };

  const playNext = () => {
    const next = pickTrack(1);
    if (next) updateState({ track_id: next.id, is_playing: Boolean(next.audio_url) });
  };

  const playPrevious = () => {
    const previous = pickTrack(-1);
    if (previous) updateState({ track_id: previous.id, is_playing: Boolean(previous.audio_url) });
  };

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

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity .4s ease', background: C.cream }}>
      <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: 'pointer', padding: 4 }}>←</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '.05em' }}>一起听</div>
          <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: '.14em' }}>living room records</div>
        </div>
        <button type="button" onClick={loadMusic} disabled={loading} style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.honeyDeep, borderRadius: 999, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, cursor: loading ? 'default' : 'pointer' }}>{loading ? '翻找中' : '刷新'}</button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '16px min(18px, 4vw) 26px' }}>
        <section style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 18, background: `linear-gradient(145deg, ${C.white}, ${C.honeyLight})`, padding: 16, boxShadow: `0 12px 30px ${C.borderLight}88` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="button" onClick={togglePlay} style={{ width: 76, height: 76, borderRadius: '50%', border: `1px solid ${C.honeyMid}`, background: `radial-gradient(circle, ${C.surface} 0 26%, ${C.honey} 27% 34%, ${C.text} 35% 38%, ${C.honeyDeep} 39% 100%)`, color: C.white, fontFamily: 'inherit', cursor: 'pointer', boxShadow: `0 10px 22px ${C.borderLight}` }}>{state.is_playing ? 'Ⅱ' : '▶'}</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.mutedLight, fontSize: 10, letterSpacing: '.16em', marginBottom: 5 }}>NOW LISTENING</div>
                <div style={{ color: C.text, fontSize: 18, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatTrack(activeTrack)}</div>
                <div style={{ whiteSpace: 'pre-wrap', color: C.muted, fontSize: 12, lineHeight: 1.65, marginTop: 4 }}>{lyricPreview(activeTrack)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button type="button" onClick={playPrevious} style={softButtonStyle(C)}>上一首</button>
              <button type="button" onClick={playNext} style={softButtonStyle(C)}>下一首</button>
              <button type="button" onClick={() => updateState({ shuffle: !state.shuffle })} style={{ ...softButtonStyle(C), background: state.shuffle ? C.honeyLight : C.surface, color: state.shuffle ? C.honeyDeep : C.muted }}>随机 {state.shuffle ? '开' : '关'}</button>
              {activeTrack && <button type="button" onClick={() => fillLyrics(activeTrack)} disabled={lyricsLoadingId === activeTrack.id} style={softButtonStyle(C)}>{lyricsLoadingId === activeTrack.id ? '找歌词中' : '找歌词'}</button>}
            </div>
            <audio ref={audioRef} controls style={{ width: '100%', marginTop: 12 }} onEnded={playNext} />
            {activeTrack?.source_url && (
              <a href={activeTrack.source_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, color: C.honeyDeep, fontSize: 12 }}>打开原曲链接</a>
            )}
          </div>

          <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 9 }}>直接搜歌</div>
            <div style={{ color: C.mutedLight, fontSize: 10.5, lineHeight: 1.6, margin: '-3px 0 9px' }}>搜索到的是官方试听片段，通常只有 30 秒；想听完整音频，可以在下面上传自己的音乐文件。</div>
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

          <details style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
            <summary style={{ color: C.text, fontWeight: 700, cursor: 'pointer' }}>手动收藏 / 上传音频</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9, marginTop: 12 }}>
              <input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="歌名" style={inputStyle(C)} />
              <input value={draft.artist} onChange={event => setDraft(current => ({ ...current, artist: event.target.value }))} placeholder="歌手" style={inputStyle(C)} />
              <input value={draft.album} onChange={event => setDraft(current => ({ ...current, album: event.target.value }))} placeholder="专辑，可不填" style={inputStyle(C)} />
            </div>
            <input value={draft.audio_url} onChange={event => setDraft(current => ({ ...current, audio_url: event.target.value }))} placeholder="可直接播放的音频链接，上传后自动填入" style={{ ...inputStyle(C), width: '100%', marginTop: 9 }} />
            <textarea value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} placeholder="备注或想显示在唱片机上的一句话……" rows={2} style={{ ...inputStyle(C), width: '100%', resize: 'vertical', marginTop: 9, borderRadius: 12 }} />
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={event => uploadAudio(event.target.files?.[0])} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={softButtonStyle(C)}>{uploading ? '上传中' : '上传音频'}</button>
              <button type="button" onClick={saveTrack} disabled={saving} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '9px 15px', fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer', opacity: saving ? .65 : 1 }}>{saving ? '保存中' : '加入歌单'}</button>
            </div>
          </details>

          {error && <div style={{ color: C.blushDeep, fontSize: 12 }}>{error}</div>}

          <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ color: C.text }}>我们的歌单</b>
              <span style={{ color: C.mutedLight, fontSize: 11 }}>{tracks.length} 首</span>
            </div>
            {!tracks.length && <div style={{ color: C.muted, fontSize: 13, padding: '18px 0', textAlign: 'center' }}>还没有歌。直接搜一首，就能放进唱片机。</div>}
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
