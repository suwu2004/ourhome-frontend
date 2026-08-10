from pathlib import Path

panel_path = Path('src/ApiUsageLogPanel.jsx')
panel = panel_path.read_text()
panel = panel.replace("import { useSettingsGroupTarget } from './useSettingsGroupTarget.js';\n", "")
anchor = """function purposeLabel(value) {
  const purpose = String(value || '').trim();
  if (purpose === 'context-ledger') return '隐藏账本整理';
  if (purpose === 'memory-journal') return '记忆整理';
  if (purpose === 'visible-thinking') return '可见思考补全';
  if (purpose === 'theater') return '小剧场';
  if (purpose === 'luze-learning-plan') return '自主学习 · 选题';
  if (purpose === 'luze-learning-synthesis') return '自主学习 · 消化';
  if (purpose === 'luze-learning-deep') return '自主学习 · 深挖';
  if (purpose === 'luze-private-consent') return '陆泽房间 · 敲门';
  return '';
}
"""
addition = anchor + """
function useSettingsConsoleTarget() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let observer = null;
    let disposed = false;

    const findTarget = () => {
      const next = document.querySelector('[data-settings-console-api-usage-target="true"]');
      if (disposed) return Boolean(next);
      setTarget(current => current === next ? current : next);
      if (next) observer?.disconnect();
      return Boolean(next);
    };

    if (!findTarget()) {
      observer = new MutationObserver(findTarget);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  return target && document.body.contains(target) ? target : null;
}
"""
if 'function useSettingsConsoleTarget()' not in panel:
    if anchor not in panel:
        raise SystemExit('ApiUsageLogPanel purposeLabel anchor missing')
    panel = panel.replace(anchor, addition, 1)
panel = panel.replace("  const groupTarget = useSettingsGroupTarget({ key: 'api-models', title: 'API 与模型' });", "  const consoleTarget = useSettingsConsoleTarget();")
panel = panel.replace('{groupTarget && createPortal(groupEntry, groupTarget)}', '{consoleTarget && createPortal(groupEntry, consoleTarget)}')
if 'useSettingsGroupTarget' in panel or 'groupTarget && createPortal' in panel:
    raise SystemExit('ApiUsageLogPanel old target still present')
panel_path.write_text(panel)

settings_path = Path('src/SettingsRoom.jsx')
settings = settings_path.read_text()
settings_anchor = """              </div>
            </div>
          </section>

          <SettingsSectionLabel theme={C}>常用设置</SettingsSectionLabel>
"""
settings_replacement = """              </div>
            </div>
            <div data-settings-console-api-usage-target="true" />
          </section>

          <SettingsSectionLabel theme={C}>常用设置</SettingsSectionLabel>
"""
if 'data-settings-console-api-usage-target="true"' not in settings:
    if settings_anchor not in settings:
        raise SystemExit('Settings console anchor missing')
    settings = settings.replace(settings_anchor, settings_replacement, 1)
settings_path.write_text(settings)

test_path = Path('scripts/api-usage-console-regression.test.mjs')
test_path.write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panelSource = readFileSync(new URL('../src/ApiUsageLogPanel.jsx', import.meta.url), 'utf8');
const settingsSource = readFileSync(new URL('../src/SettingsRoom.jsx', import.meta.url), 'utf8');

test('API usage entry lives in the top settings console instead of API/model settings', () => {
  assert.match(settingsSource, /data-settings-console-api-usage-target=\"true\"/);
  assert.match(panelSource, /function useSettingsConsoleTarget\(\)/);
  assert.match(panelSource, /createPortal\(groupEntry, consoleTarget\)/);
  assert.doesNotMatch(panelSource, /useSettingsGroupTarget/);
  assert.doesNotMatch(panelSource, /key: 'api-models', title: 'API 与模型'/);
});

test('API usage detail keeps the unified back-left and refresh-right header', () => {
  assert.match(panelSource, /aria-label=\"返回设置\"/);
  assert.match(panelSource, /aria-label=\"刷新调用记录\"/);
  assert.match(panelSource, /gridTemplateColumns: '40px minmax\(0,1fr\) 40px'/);
});
""")

package_path = Path('package.json')
package = package_path.read_text()
needle = 'scripts/global-sync-regression.test.mjs scripts/chat-history-paging-regression.test.mjs'
replacement = 'scripts/global-sync-regression.test.mjs scripts/chat-history-paging-regression.test.mjs scripts/api-usage-console-regression.test.mjs'
if 'scripts/api-usage-console-regression.test.mjs' not in package:
    if needle not in package:
        raise SystemExit('package test:app anchor missing')
    package = package.replace(needle, replacement, 1)
package_path.write_text(package)
