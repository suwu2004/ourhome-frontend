import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';

const emptyTrack = {
  title: '',
  artist: '',
  album: '',
  audio_url: '',
  source_url: '',
  cover_url: '',
  note: '',
};

function formatTrack(track) {
  if (!track) return '还没有选歌';
  return [track.title, track.artist].filter(Boolean).join(' · ') || '未命名歌曲';
}

export function MusicRoom({ visible, theme, leaveRoom }) {
  const C = theme;
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tracks, setTracks] = useState([]);
  const [state, setState] = useState({ track_id: null, is_playing: false });
  const [draft, setDraft] = useState(emptyTrack);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      setState(stateData || { track_id: null, is_playing: false });
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

  const selectTrack = track => {
    updateState({ track_id: track.id, is_playing: Boolean(track.audio_url) });
  };

  const togglePlay = () => {
    if (!activeTrack?.audio_url) {
      setError(activeTrack ? '这首歌没有可直接播放的音频链接，可以点“打开原曲”。' : '先往歌单里加一首歌。');
      return;
    }
    updateState({ track_id: activeTrack.id, is_playing: !state.is_playing });
  };

  const playNext = () => {
    if (!tracks.length) return;
    const index = Math.max(0, tracks.findIndex(track => String(track.id) === String(activeTrack?.id)));
    const next = tracks[(index + 1) % tracks.length];
    updateState({ track_id: next.id, is_playing: Boolean(next.audio_url) });
  };

  const saveTrack = async () => {
    if (!draft.title.trim() && !draft.audio_url.trim() && !draft.source_url.trim()) {
      setError('至少写歌名，或者贴一个链接。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/music/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '这首歌没有放进歌单');
      setTracks(items => [data, ...items]);
      setDraft(emptyTrack);
      if (!activeTrack) updateState({ track_id: data.id, is_playing: Boolean(data.audio_url) });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
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
                <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{activeTrack?.album || activeTrack?.note || '客厅唱片机等你放第一首。'}</div>
              </div>
              <button type="button" onClick={playNext} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.honeyDeep, padding: '8px 11px', fontFamily: 'inherit', cursor: 'pointer' }}>下一首</button>
            </div>
            <audio ref={audioRef} controls style={{ width: '100%', marginTop: 12 }} onEnded={playNext} />
            {activeTrack?.source_url && (
              <a href={activeTrack.source_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 8, color: C.honeyDeep, fontSize: 12 }}>打开原曲链接</a>
            )}
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 10 }}>往歌单里放一首</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 9 }}>
              <input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="歌名" style={inputStyle(C)} />
              <input value={draft.artist} onChange={event => setDraft(current => ({ ...current, artist: event.target.value }))} placeholder="歌手" style={inputStyle(C)} />
              <input value={draft.album} onChange={event => setDraft(current => ({ ...current, album: event.target.value }))} placeholder="专辑，可不填" style={inputStyle(C)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 9, marginTop: 9 }}>
              <input value={draft.audio_url} onChange={event => setDraft(current => ({ ...current, audio_url: event.target.value }))} placeholder="可直接播放的音频链接，或上传后自动填入" style={inputStyle(C)} />
              <input value={draft.source_url} onChange={event => setDraft(current => ({ ...current, source_url: event.target.value }))} placeholder="QQ/网易/Spotify 等原曲链接" style={inputStyle(C)} />
            </div>
            <textarea value={draft.note} onChange={event => setDraft(current => ({ ...current, note: event.target.value }))} placeholder="为什么想一起听、适合什么时候听……" rows={2} style={{ ...inputStyle(C), width: '100%', resize: 'vertical', marginTop: 9, borderRadius: 12 }} />
            <div style={{ display: 'flex', gap: 9, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
              <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={event => uploadAudio(event.target.files?.[0])} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={softButtonStyle(C)}>{uploading ? '上传中…' : '上传音频'}</button>
              <button type="button" onClick={saveTrack} disabled={saving} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '9px 15px', fontFamily: 'inherit', cursor: saving ? 'default' : 'pointer', opacity: saving ? .65 : 1 }}>{saving ? '保存中…' : '加入歌单'}</button>
              {error && <span style={{ color: C.blushDeep, fontSize: 12 }}>{error}</span>}
            </div>
          </div>

          <section style={{ border: `1px solid ${C.border}`, borderRadius: 16, background: C.white, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ color: C.text }}>我们的歌单</b>
              <span style={{ color: C.mutedLight, fontSize: 11 }}>{tracks.length} 首</span>
            </div>
            {!tracks.length && <div style={{ color: C.muted, fontSize: 13, padding: '18px 0', textAlign: 'center' }}>还没有歌。先放一首我们的小曲子。</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tracks.map(track => (
                <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${String(activeTrack?.id) === String(track.id) ? C.honeyMid : C.borderLight}`, background: String(activeTrack?.id) === String(track.id) ? C.honeyLight : C.surface, borderRadius: 13, padding: '10px 11px' }}>
                  <button type="button" onClick={() => selectTrack(track)} style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.border}`, background: C.white, color: C.honeyDeep, cursor: 'pointer' }}>{String(activeTrack?.id) === String(track.id) && state.is_playing ? 'Ⅱ' : '▶'}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                    <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[track.artist, track.album, track.note].filter(Boolean).join(' · ') || '没有备注'}</div>
                  </div>
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
    padding: '9px 13px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
}
