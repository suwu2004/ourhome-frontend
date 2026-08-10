from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

ctx_path = Path('src/MusicPlayerContext.jsx')
ctx = ctx_path.read_text()
old = """      const localState = stateRef.current;
      const audio = audioRef.current;
      const keepLocalPlayback = Boolean(localState.is_playing && audio && !audio.paused && !audio.ended);
      const nextState = keepLocalPlayback
        ? {
            ...remoteState,
            track_id: localState.track_id || remoteState.track_id,
            is_playing: true,
            shuffle: localState.shuffle,
            repeat_mode: localState.repeat_mode || remoteState.repeat_mode,
            background_url: localState.background_url || remoteState.background_url,
          }
        : remoteState;
"""
new = """      const localState = stateRef.current;
      const audio = audioRef.current;
      const localUpdatedAt = Date.parse(localState.updated_at || '');
      const remoteUpdatedAt = Date.parse(remoteState.updated_at || '');
      const keepLocalIntent = Number.isFinite(localUpdatedAt)
        && (!Number.isFinite(remoteUpdatedAt) || localUpdatedAt >= remoteUpdatedAt);
      const keepLocalPlayback = Boolean(localState.is_playing && audio && !audio.paused && !audio.ended);
      const nextState = (keepLocalIntent || keepLocalPlayback)
        ? {
            ...remoteState,
            track_id: localState.track_id || remoteState.track_id,
            is_playing: Boolean(localState.is_playing),
            shuffle: localState.shuffle,
            repeat_mode: localState.repeat_mode || remoteState.repeat_mode,
            background_url: localState.background_url || remoteState.background_url,
            updated_at: localState.updated_at || remoteState.updated_at,
          }
        : remoteState;
"""
ctx = replace_once(ctx, old, new, 'preserve local pause intent')
ctx_path.write_text(ctx)

room_path = Path('src/MusicRoom.jsx')
room = room_path.read_text()
anchor = """function lyricText(track) {
"""
helper = """function qqMusicSongMid(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const queryMid = url.searchParams.get('songmid') || url.searchParams.get('mid');
    if (queryMid && /^[A-Za-z0-9]+$/.test(queryMid)) return queryMid;
    const match = url.pathname.match(/(?:songDetail|song)\/([A-Za-z0-9]+)/i);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

function qqMusicDeepLink(sourceUrl) {
  const mid = qqMusicSongMid(sourceUrl);
  if (!mid) return 'qqmusic://';
  const payload = encodeURIComponent(JSON.stringify({ song: [{ type: '0', songmid: mid }], action: 'play' }));
  return `qqmusic://qq.com/media/playSonglist?p=${payload}`;
}

function isMobileClient() {
  return /Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(navigator.userAgent || '');
}

""" + anchor
room = replace_once(room, anchor, helper, 'QQ deep-link helpers')
old = """  const openSourceTrack = track => {
    if (!track?.source_url) return;
    window.open(track.source_url, '_blank', 'noopener,noreferrer');
  };
"""
new = """  const openSourceTrack = track => {
    if (!track?.source_url) return;
    const parsed = parseQqMusicShare(track.source_url);
    if (!parsed.valid || !isMobileClient()) {
      window.open(track.source_url, '_blank', 'noopener,noreferrer');
      return;
    }

    let cancelled = false;
    const cancelFallback = () => {
      if (document.visibilityState === 'hidden') cancelled = true;
    };
    document.addEventListener('visibilitychange', cancelFallback, { once: true });
    window.location.href = qqMusicDeepLink(track.source_url);
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', cancelFallback);
      if (!cancelled && document.visibilityState === 'visible') window.location.href = track.source_url;
    }, 900);
  };
"""
room = replace_once(room, old, new, 'QQ app first open')
room_path.write_text(room)

pkg_path = Path('package.json')
pkg = pkg_path.read_text()
anchor_script = 'scripts/android-update-progress-regression.test.mjs scripts/font-loading-regression.test.mjs scripts/settings-lazy-mount-regression.test.mjs'
if anchor_script not in pkg:
    raise SystemExit('test:app anchor missing')
if 'scripts/music-playback-regression.test.mjs' not in pkg:
    pkg = pkg.replace(anchor_script, anchor_script + ' scripts/music-playback-regression.test.mjs', 1)
pkg_path.write_text(pkg)

Path('scripts/music-playback-regression.test.mjs').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contextSource = readFileSync(new URL('../src/MusicPlayerContext.jsx', import.meta.url), 'utf8');
const roomSource = readFileSync(new URL('../src/MusicRoom.jsx', import.meta.url), 'utf8');

test('re-entering Together Listening preserves a newer local pause intent', () => {
  assert.match(contextSource, /keepLocalIntent/);
  assert.match(contextSource, /localUpdatedAt >= remoteUpdatedAt/);
  assert.match(contextSource, /is_playing: Boolean\(localState\.is_playing\)/);
});

test('QQ Music share links prefer the app on mobile and fall back to web', () => {
  assert.match(roomSource, /qqmusic:\/\/qq\.com\/media\/playSonglist/);
  assert.match(roomSource, /songDetail\|song/);
  assert.match(roomSource, /document\.visibilityState === 'visible'/);
  assert.match(roomSource, /900/);
});
""")
