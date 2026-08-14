import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const memory = fs.readFileSync(new URL('../src/MemoryRoom.jsx', import.meta.url), 'utf8');
const worldbooks = fs.readFileSync(new URL('../src/WorldbookLibrary.jsx', import.meta.url), 'utf8');
const rules = fs.readFileSync(new URL('../src/TheaterRuleLibrary.jsx', import.meta.url), 'utf8');

test('memory room is the shared entry for persona, memory, rules, and lorebooks', () => {
  assert.match(memory, /陆泽的大脑/);
  assert.match(memory, /TheaterRuleLibrary placement="memory"/);
  assert.match(memory, /<WorldbookLibrary \/>/);
  assert.match(memory, /规则约束陆泽怎样表达与行动/);
});

test('worldbook UI exposes activation, budgets, bindings, import, and v3 export', () => {
  assert.match(worldbooks, /scan_depth/);
  assert.match(worldbooks, /token_budget/);
  assert.match(worldbooks, /recursive_scanning/);
  assert.match(worldbooks, /target_book_id/);
  assert.match(worldbooks, /lorebooks\/import/);
  assert.match(worldbooks, /导出 V3/);
  assert.match(worldbooks, /主要触发词/);
  assert.match(worldbooks, /主要词与次要词共同命中/);
});

test('theater keeps a shortcut to the same scoped rule library', () => {
  assert.match(rules, /placement = 'theater'/);
  assert.match(rules, /placement === 'memory'/);
  assert.match(rules, /只进小剧场、只进 Chat/);
});
