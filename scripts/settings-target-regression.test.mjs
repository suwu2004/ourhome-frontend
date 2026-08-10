import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/useSettingsGroupTarget.js', import.meta.url), 'utf8');

test('settings portal discovery stops observing the whole app after its target is found', () => {
  assert.match(source, /const stopObserver = \(\) =>/);
  assert.match(source, /if \(next\) stopObserver\(\)/);
  assert.match(source, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(source, /characterData:\s*true/);
});
