import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [installSettings, recovery, room, folders, toybox, toyboxStyles, gomokuStyles] = await Promise.all([
  readFile(new URL('../src/AppInstallSettings.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/FailoverRecoverySettings.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/LuzePrivateRoom.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/LuzeDailyFolders.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/ToyBoxSharedRoom.jsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/ToyBoxRoom.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/ToyBoxGomoku.css', import.meta.url), 'utf8'),
]);

test('data management puts recovery first and update last', () => {
  const recoveryIndex = installSettings.indexOf('<FailoverRecoverySettings />');
  const deviceIndex = installSettings.indexOf('设备与数据状态');
  const updateIndex = installSettings.indexOf('app-maintenance-update');
  assert.ok(recoveryIndex >= 0 && recoveryIndex < deviceIndex);
  assert.ok(deviceIndex < updateIndex);
  assert.doesNotMatch(installSettings, /版本检查、主库与灾备都收在数据管理里/);
  assert.match(installSettings, /display: 'grid', gap: 3/);
});

test('failover recovery is one guarded check-or-replay action', () => {
  assert.match(recovery, /检查回灌/);
  assert.match(recovery, /安全回灌/);
  assert.match(recovery, /重新试试/);
  assert.match(recovery, /blockedBySecrets/);
  assert.match(recovery, /confirmation: 'supabase-restored'/);
  assert.equal((recovery.match(/<button/g) || []).length, 1);
});

test('Luze private room groups every tab into Shanghai-date folders', () => {
  assert.match(room, /function shanghaiDateKey/);
  assert.match(room, /timeZone: 'Asia\/Shanghai'/);
  assert.match(room, /function groupEntriesByDay/);
  assert.match(room, /function DailyFolderList/);
  assert.match(room, /<DailyFolderList kind=\{tab\} items=\{grouped\[tab\]\} \/>/);
  assert.match(room, /defaultOpen=\{index === 0\}/);
  assert.match(room, /LuzeDailyFolders\.css/);
});

test('closed Luze day folders avoid mounting old card trees', () => {
  assert.match(room, /function DailyFolder\(/);
  assert.match(room, /const \[open, setOpen\] = useState\(defaultOpen\)/);
  assert.match(room, /onToggle=\{event => setOpen\(event\.currentTarget\.open\)\}/);
  assert.match(room, /\{open && <div className="luze-folder-body">/);
  assert.match(room, /useMemo\(\(\) => groupEntriesByDay\(items\), \[items\]\)/);
  assert.match(room, /SHANGHAI_CLOCK_FORMATTER/);
  assert.match(room, /SHANGHAI_DATE_PARTS_FORMATTER/);
  assert.match(room, /SHANGHAI_FOLDER_LABEL_FORMATTER/);
});

test('Luze room can surface the balanced learning source mode', () => {
  assert.match(room, /learning_mode === 'ourhome'/);
  assert.match(room, /learning_mode === 'curiosity'/);
  assert.match(room, /每天的搜索一半跟着 OurHome 和最近聊天里的线索走，一半留给自己的随机好奇/);
  assert.match(folders, /luze-learning-mode/);
  assert.match(folders, /luze-day-folder::before/);
});

test('Toy Bear history shows the actual harmony answers and keeps game cards in one palette', () => {
  assert.match(toybox, /我们都选了「\$\{shared\}」/);
  assert.match(toybox, /你选「\$\{mine \|\| '—'\}」 · 陆泽选「\$\{luze \|\| '—'\}」/);
  const sharedCardBackground = /linear-gradient\(145deg, rgba\(255,250,241,\.98\), rgba\(246,229,190,\.76\)\)/g;
  assert.equal((toyboxStyles.match(sharedCardBackground) || []).length, 3);
  assert.match(gomokuStyles, sharedCardBackground);
});
