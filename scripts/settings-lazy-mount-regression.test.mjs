import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('SettingsGroup can defer expensive children until first open while retaining them after close', async () => {
  const source = await read('../src/SettingsGroup.jsx');
  assert.match(source, /mountOnOpen = false/);
  assert.match(source, /childrenMounted/);
  assert.match(source, /nextOpen && mountOnOpen/);
  assert.match(source, /childrenMounted \? children : null/);
  assert.doesNotMatch(source, /setChildrenMounted\(false\)/);
});

test('API, mail and web-MCP settings opt into mount-on-open', async () => {
  const source = await read('../src/SettingsRoom.jsx');
  const matches = source.match(/mountOnOpen/g) || [];
  assert.equal(matches.length, 3);
  assert.match(source, /title="API 与模型"[\s\S]{0,260}mountOnOpen/);
  assert.match(source, /title="陆泽邮箱"[\s\S]{0,260}mountOnOpen/);
  assert.match(source, /title="联网与 MCP"[\s\S]{0,260}mountOnOpen/);
});

test('deferred connection panels are genuinely mount-fetching components', async () => {
  const [profiles, integrations, mail] = await Promise.all([
    read('../src/ApiProfilesSettings.jsx'),
    read('../src/IntegrationSettings.jsx'),
    read('../src/AgentMailSettings.jsx'),
  ]);
  assert.match(profiles, /useEffect\(\(\) => \{[\s\S]{0,180}loadProfiles\(\);[\s\S]{0,180}loadDrawingConfig\(\);[\s\S]{0,80}\}, \[\]\)/);
  assert.match(integrations, /useEffect\(\(\) => \{ loadConnections\(\); \}, \[loadConnections\]\)/);
  assert.match(mail, /useEffect\(\(\) => \{[\s\S]*loadConfig\(\)/);
});
