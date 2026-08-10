from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

# Let expensive settings groups delay mounting their children until first open.
path = Path('src/SettingsGroup.jsx')
text = path.read_text()
text = replace_once(
    text,
    "export function SettingsGroup({ theme, icon = '✦', title, subtitle, children, defaultOpen = false, resetKey, openSignal }) {\n  const [open, setOpen] = useState(defaultOpen);",
    "export function SettingsGroup({ theme, icon = '✦', title, subtitle, children, defaultOpen = false, resetKey, openSignal, mountOnOpen = false }) {\n  const [open, setOpen] = useState(defaultOpen);\n  const [childrenMounted, setChildrenMounted] = useState(() => !mountOnOpen || defaultOpen);",
    'add mount-on-open state',
)
text = replace_once(
    text,
    """  useEffect(() => {
    if (openSignal?.key !== undefined) setOpen(Boolean(openSignal.open));
  }, [openSignal?.key]);
""",
    """  useEffect(() => {
    if (openSignal?.key === undefined) return;
    const nextOpen = Boolean(openSignal.open);
    setOpen(nextOpen);
    if (nextOpen && mountOnOpen) setChildrenMounted(true);
  }, [mountOnOpen, openSignal?.key]);

  const toggleOpen = () => {
    setOpen(value => {
      const nextOpen = !value;
      if (nextOpen && mountOnOpen) setChildrenMounted(true);
      return nextOpen;
    });
  };
""",
    'mount children on explicit open',
)
text = replace_once(text, 'onClick={() => setOpen(value => !value)}', 'onClick={toggleOpen}', 'use guarded toggle')
text = replace_once(
    text,
    "<div hidden={!open} style={{ padding: '14px 14px 15px', borderTop: `1px solid ${theme.borderLight}` }}>{children}</div>",
    "<div hidden={!open} style={{ padding: '14px 14px 15px', borderTop: `1px solid ${theme.borderLight}` }}>{childrenMounted ? children : null}</div>",
    'defer child mount',
)
path.write_text(text)

# Mark the three connection-heavy groups as mount-on-open.
path = Path('src/SettingsRoom.jsx')
text = path.read_text()
text = replace_once(
    text,
    '<SettingsGroup theme={C} icon="AI" title="API 与模型" subtitle={selectedModel ? `当前：${selectedModel}` : \'保存、切换站点并拉取全部模型\'} resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>',
    '<SettingsGroup theme={C} icon="AI" title="API 与模型" subtitle={selectedModel ? `当前：${selectedModel}` : \'保存、切换站点并拉取全部模型\'} resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal} mountOnOpen>',
    'lazy API group',
)
text = replace_once(
    text,
    '<SettingsGroup theme={C} icon="✉" title="陆泽邮箱" subtitle="自主收发、实时收信与完整知情记录" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>',
    '<SettingsGroup theme={C} icon="✉" title="陆泽邮箱" subtitle="自主收发、实时收信与完整知情记录" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal} mountOnOpen>',
    'lazy mail group',
)
text = replace_once(
    text,
    '<SettingsGroup theme={C} icon="⌁" title="联网与 MCP" subtitle="Linkup、Tavily 与远程只读工具" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>',
    '<SettingsGroup theme={C} icon="⌁" title="联网与 MCP" subtitle="Linkup、Tavily 与远程只读工具" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal} mountOnOpen>',
    'lazy integration group',
)
path.write_text(text)

# Regression proves the groups with mount-time GETs are not mounted while collapsed.
test_path = Path('scripts/settings-lazy-mount-regression.test.mjs')
test_path.write_text(r'''import test from 'node:test';
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
  assert.match(profiles, /useEffect\(\(\) => \{ loadProfiles\(\); \}, \[\]\)/);
  assert.match(integrations, /useEffect\(\(\) => \{ loadConnections\(\); \}, \[loadConnections\]\)/);
  assert.match(mail, /useEffect\(\(\) => \{[\s\S]*loadConfig\(\)/);
});
''')

path = Path('package.json')
text = path.read_text()
text = replace_once(
    text,
    'scripts/android-update-progress-regression.test.mjs scripts/font-loading-regression.test.mjs',
    'scripts/android-update-progress-regression.test.mjs scripts/font-loading-regression.test.mjs scripts/settings-lazy-mount-regression.test.mjs',
    'include settings lazy mount regression',
)
path.write_text(text)
