from pathlib import Path


def replace_once(path, old, new, label):
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    file.write_text(text.replace(old, new, 1))


replace_once(
    'src/SettingsRoom.jsx',
    "import AppInstallSettings from './AppInstallSettings.jsx';",
    "import AppInstallSettings from './AppInstallSettings.jsx';\nimport FailoverRecoverySettings from './FailoverRecoverySettings.jsx';",
    'Settings recovery import',
)
replace_once(
    'src/SettingsRoom.jsx',
    '                <AppInstallSettings compact />',
    '                <AppInstallSettings compact />\n                <FailoverRecoverySettings active={stage === "home" && view === "settings"} />',
    'Settings recovery control',
)

replace_once(
    'android/app/src/main/java/com/ourhome/app/OurHomeUpdaterPlugin.java',
    'status == HttpURLConnection.HTTP_REQUESTED_RANGE_NOT_SATISFIABLE',
    'status == 416',
    'HTTP 416 compatibility',
)

lock_path = Path('package-lock.json')
lock_text = lock_path.read_text()
if lock_text.count('"version": "1.0.2"') < 2:
    raise SystemExit('package-lock root version anchors missing')
lock_path.write_text(lock_text.replace('"version": "1.0.2"', '"version": "1.0.4"', 2))

app_test = Path('scripts/app-shell-regression.test.mjs')
test_text = app_test.read_text()
test_text = test_text.replace(
    'appSource, settingsSource] = await Promise.all([',
    'appSource, settingsSource, failoverRecovery] = await Promise.all([',
    1,
)
test_text = test_text.replace(
    "  readFile(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8'),\n]);",
    "  readFile(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8'),\n  readFile(new URL('../src/FailoverRecoverySettings.jsx', import.meta.url), 'utf8'),\n]);",
    1,
)
test_text = test_text.replace('/\\?: "4"/', '/\\?: "5"/', 1)
test_text = test_text.replace('1\\.0\\.3', '1\\.0\\.4')
needle = "  assert.match(androidWorkflow, /--latest/);\n});"
replacement = """  assert.match(androidWorkflow, /--latest/);
  assert.match(appUpdate, /expectedBytes/);
  assert.match(appUpdate, /apkSha256/);
  assert.match(updaterPlugin, /MAX_DOWNLOAD_ATTEMPTS/);
  assert.match(updaterPlugin, /OurHome-latest\\.apk\\.part/);
  assert.match(updaterPlugin, /Range/);
  assert.match(updaterPlugin, /SHA-256/);
});"""
if test_text.count(needle) != 1:
    raise SystemExit('native updater regression anchor missing')
test_text = test_text.replace(needle, replacement, 1)
needle = "test('expired private backgrounds recover without an upload loop', () => {"
recovery_test = """test('Settings exposes guarded one-tap Supabase recovery', () => {
  assert.match(settingsSource, /FailoverRecoverySettings/);
  assert.match(failoverRecovery, /failover\\/status/);
  assert.match(failoverRecovery, /failover\\/replay/);
  assert.match(failoverRecovery, /primary_ready/);
  assert.match(failoverRecovery, /supabase-restored/);
  assert.match(failoverRecovery, /安全回灌/);
});

"""
if test_text.count(needle) != 1:
    raise SystemExit('recovery regression insertion anchor missing')
test_text = test_text.replace(needle, recovery_test + needle, 1)
app_test.write_text(test_text)
