import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'src', 'App.jsx'), 'utf8');
const apiProfiles = fs.readFileSync(path.join(root, 'src', 'ApiProfilesSettings.jsx'), 'utf8');
const music = fs.readFileSync(path.join(root, 'src', 'MusicRoom.jsx'), 'utf8');

test('calendar day colors merge local history into cloud settings and save future changes', () => {
  assert.match(app, /sharedSettings\.calendar_day_colors/);
  assert.match(app, /calendar_day_colors:\s*normalizeCalendarDayColors\(dayColors\)/);
  assert.match(app, /localStorage\.setItem\('ourhome_day_colors'/);
});

test('opening settings explicitly refreshes persona and asset references', () => {
  assert.match(app, /view !== 'settings'/);
  assert.match(app, /refreshTheme\(\{ refreshAssets: true \}\)/);
  assert.match(app, /hasOwnProperty\.call\(data \|\| \{\}, 'system_prompt'\)/);
  assert.match(app, /setSystemPromptInput\(String\(data\.system_prompt \|\| ''\)\)/);
});

test('automatic API refresh keeps the selected model quiet and avoids duplicate pulls', () => {
  assert.match(app, /preferredModel \|\| selectedModelRef\.current/);
  assert.match(app, /setModelsError\(fallbackModels\.length \? ''/);
  assert.match(apiProfiles, /lastNotifiedActiveRef/);
  assert.match(apiProfiles, /activeSignature !== lastNotifiedActiveRef\.current/);
  assert.match(apiProfiles, /data\.degraded \? \(data\.notice/);
  assert.match(apiProfiles, /role="status"/);
});

test('Together Listening keeps QQ Music import and removes local audio upload', () => {
  assert.match(music, /\['qqmusic', 'QQ 音乐'\]/);
  assert.doesNotMatch(music, /\['upload'/);
  assert.doesNotMatch(music, /tab === 'upload'/);
  assert.doesNotMatch(music, /accept="audio\/\*"/);
  assert.doesNotMatch(music, />上传音频</);
});
