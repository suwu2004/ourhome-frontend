import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panelSource = readFileSync(new URL('../src/ApiUsageLogPanel.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8');

test('API usage entry lives in the top settings console instead of API/model settings', () => {
  assert.match(settingsSource, /data-settings-console-api-usage-target="true"/);
  assert.match(panelSource, /function useSettingsConsoleTarget\(\)/);
  assert.match(panelSource, /createPortal\(groupEntry, consoleTarget\)/);
  assert.doesNotMatch(panelSource, /useSettingsGroupTarget/);
  assert.doesNotMatch(panelSource, /key: 'api-models', title: 'API 与模型'/);
});

test('API usage detail keeps the unified back-left and refresh-right header', () => {
  assert.match(panelSource, /aria-label="返回设置"/);
  assert.match(panelSource, /aria-label="刷新调用记录"/);
  assert.match(panelSource, /gridTemplateColumns: '40px minmax\(0,1fr\) 40px'/);
});
