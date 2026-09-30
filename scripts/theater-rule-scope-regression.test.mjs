import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/TheaterRuleLibrary.jsx', import.meta.url), 'utf8');

test('rule cards expose theater, Chat and shared scopes', () => {
  assert.match(source, /value: 'theater', label: '仅小剧场'/);
  assert.match(source, /value: 'chat', label: '仅 Chat'/);
  assert.match(source, /value: 'both', label: '两边都用'/);
  assert.match(source, /生效范围/);
});

test('new and imported rules default to theater scope', () => {
  assert.match(source, /apply_scope: 'theater'/);
  assert.match(source, /normalizeScope/);
  assert.match(source, /scopeLabel/);
});

test('scope changes are represented in the rule model and UI', () => {
  assert.match(source, /rule\.apply_scope/);
  assert.match(source, /onScope/);
  assert.match(source, /normalizeScope\(rule\.apply_scope\)/);
  assert.match(source, /disabled=\{busy\}/);
});
