import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/TheaterRuleLibrary.jsx', import.meta.url), 'utf8');

test('rule cards expose theater, Chat and shared scopes', () => {
  assert.match(source, /value: 'theater', label: '仅小剧场'/);
  assert.match(source, /value: 'chat', label: '仅 Chat'/);
  assert.match(source, /value: 'both', label: '两边都用'/);
  assert.match(source, /的生效范围/);
});

test('new and imported rules stay theater-only until the owner changes them', () => {
  assert.match(source, /apply_scope: 'theater'/);
  assert.match(source, /新上传的规则默认仅用于小剧场/);
});

test('scope changes persist through the rule API', () => {
  assert.match(source, /body: JSON\.stringify\(\{ apply_scope: normalizeScope\(applyScope\) \}\)/);
  assert.match(source, /剧场记忆始终不会进入 Chat/);
});
