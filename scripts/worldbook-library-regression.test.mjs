import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const memory = fs.readFileSync(new URL('../src/MemoryRoom.jsx', import.meta.url), 'utf8');
const memoryCss = fs.readFileSync(new URL('../src/MemoryRoom.css', import.meta.url), 'utf8');
const root = fs.readFileSync(new URL('../src/Root.jsx', import.meta.url), 'utf8');
const theater = fs.readFileSync(new URL('../src/TheaterRoom.jsx', import.meta.url), 'utf8');
const worldbooks = fs.readFileSync(new URL('../src/WorldbookLibrary.jsx', import.meta.url), 'utf8');
const worldbookCss = fs.readFileSync(new URL('../src/WorldbookLibrary.css', import.meta.url), 'utf8');
const rules = fs.readFileSync(new URL('../src/TheaterRuleLibrary.jsx', import.meta.url), 'utf8');
const ruleCss = fs.readFileSync(new URL('../src/TheaterRuleLibrary.css', import.meta.url), 'utf8');

test('memory room is the shared entry for persona, memory, rules, and lorebooks', () => {
  assert.match(memory, /陆泽的大脑/);
  assert.match(memory, /<TheaterRuleLibrary \/>/);
  assert.match(memory, /<WorldbookLibrary \/>/);
  assert.match(memory, /规则约束陆泽怎样表达与行动/);
});

test('active memory stays separate while the three automatic layers share one overview card', () => {
  assert.match(memory, /title="主动记忆"/);
  assert.match(memory, /title="记忆总览"/);
  assert.match(memory, /核心、阶段和临时记忆放在同一个框里/);
  assert.match(memory, /className="memory-layer-tabs" role="tablist"/);
  assert.doesNotMatch(memory, /title="记忆分层"/);
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

test('theater no longer duplicates the shared rule-library controls', () => {
  assert.doesNotMatch(root, /TheaterRuleLibrary/);
  assert.doesNotMatch(theater, /globalRulesOpen|loadGlobalRules|小剧场通用规则/);
  assert.doesNotMatch(rules, /createPortal|MutationObserver|placement = 'theater'/);
  assert.match(rules, /只进小剧场、只进 Chat/);
});

test('memory, rules, and worldbooks keep a one-hand mobile layout', () => {
  assert.match(memoryCss, /@media \(max-width: 560px\)[\s\S]*\.memory-knowledge-grid \{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(memoryCss, /\.memory-layer-tabs \{[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(worldbookCss, /@media \(max-width: 760px\)[\s\S]*\.worldbook-layer \{ align-items: flex-end/);
  assert.match(ruleCss, /@media \(max-width: 460px\)[\s\S]*\.theater-rule-editor-actions \{\s*grid-template-columns: 1fr/);
});
