import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';

const MusicPlayerContext = createContext(null);

export function MusicPlayerProvider({ children }) {
  const audioRef = useRef(null);
  const stateRef = useRef({ track_id: null, is_playing: false, shuffle: false });
  const [tracks, setTracks] = useState([]);
  const [state, setState] = useState(stateRef.current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const activeTrack = useMemo(
    () => tracks.find(track => String(track.id) === String(state.track_id)) || tracks[0] || null,
    [tracks, state.track_id],
  );

  const updateState = useCallback(async patch => {
    const next = { ...stateRef.current, ...patch, updated_at: new Date().toISOString() };
    stateRef.current = next;
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
  }, []);

  const loadMusic = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tracksResponse, stateResponse] = await Promise.all([
        apiFetch(`${BACKEND}/music/tracks`),
        apiFetch(`${BACKEND}/music/state`),
      ]);
      const tracksData = await tracksResponse.json().catch(() => []);
      const stateData = await stateResponse.json().catch(() => ({}));
      if (!tracksResponse.ok) throw new Error(tracksData?.error || '歌单没有回来');
      if (!stateResponse.ok) throw new Error(stateData?.error || '播放状态没有回来');
      setTracks(Array.isArray(tracksData) ? tracksData : []);
      const nextState = { track_id: null, is_playing: false, shuffle: false, ...(stateData || {}) };
      stateRef.current = nextState;
      setState(nextState);
    } catch (err) {
      setError(err.message || '唱片机暂时没有回来');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMusic();
    window.addEventListener('ourhome-auth-changed', loadMusic);
    return () => window.removeEventListener('ourhome-auth-changed', loadMusic);
  }, [loadMusic]);

  const pickTrack = useCallback((direction = 1) => {
    if (!tracks.length) return null;
    if (state.shuffle && tracks.length > 1) {
      const candidates = tracks.filter(track => String(track.id) !== String(activeTrack?.id));
      return candidates[Math.floor(Math.random() * candidates.length)] || tracks[0];
    }
    const index = Math.max(0, tracks.findIndex(track => String(track.id) === String(activeTrack?.id)));
    return tracks[(index + direction + tracks.length) % tracks.length];
  }, [activeTrack?.id, state.shuffle, tracks]);

  const selectTrack = useCallback(track => {
    if (!track) return;
    updateState({ track_id: track.id, is_playing: Boolean(track.audio_url) });
  }, [updateState]);

  const togglePlay = useCallback(() => {
    if (!activeTrack?.audio_url) {
      setError(activeTrack ? '这首歌没有可直接播放的试听，换一首搜到的歌试试。' : '先搜一首歌放进歌单。');
      return;
    }
    updateState({ track_id: activeTrack.id, is_playing: !stateRef.current.is_playing });
  }, [activeTrack, updateState]);

  const playNext = useCallback(() => {
    const next = pickTrack(1);
    if (next) updateState({ track_id: next.id, is_playing: Boolean(next.audio_url) });
  }, [pickTrack, updateState]);

  const playPrevious = useCallback(() => {
    const previous = pickTrack(-1);
    if (previous) updateState({ track_id: previous.id, is_playing: Boolean(previous.audio_url) });
  }, [pickTrack, updateState]);

  const toggleShuffle = useCallback(() => {
    updateState({ shuffle: !stateRef.current.shuffle });
  }, [updateState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (activeTrack?.audio_url && audio.getAttribute('src') !== activeTrack.audio_url) {
      audio.src = activeTrack.audio_url;
    }
    if (state.is_playing && activeTrack?.audio_url) {
      audio.play().catch(() => updateState({ is_playing: false }));
    } else {
      audio.pause();
    }
  }, [activeTrack?.audio_url, state.is_playing, updateState]);

  const value = useMemo(() => ({
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
    toggleShuffle,
  }), [activeTrack, error, loadMusic, loading, playNext, playPrevious, selectTrack, state, togglePlay, toggleShuffle, tracks, updateState]);

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} onEnded={playNext} style={{ display: 'none' }} />
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error('useMusicPlayer 必须在 MusicPlayerProvider 内使用');
  return value;
}
