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
const mobilePolish = fs.readFileSync(new URL('../src/MobileUiPolish.css', import.meta.url), 'utf8');

test('memory room is the shared entry for persona, memory, rules, and lorebooks', () => {
  assert.match(memory, /陆泽的大脑/);
  assert.match(memory, /<TheaterRuleLibrary \/>/);
  assert.match(memory, /<WorldbookLibrary \/>/);
  assert.doesNotMatch(memory, /管表达与行动|管人物与背景|管真实经历/);
  assert.match(memory, /mountOnOpen/);
});

test('active memory stays separate while the three automatic layers share one overview card', () => {
  assert.match(memory, /title="主动记忆"/);
  assert.match(memory, /title="记忆总览"/);
  assert.match(memory, /核心、阶段和临时记忆放在同一个框里/);
  assert.match(memory, /className="memory-layer-tabs" role="tablist"/);
  assert.doesNotMatch(memory, /title="记忆分层"/);
});

test('worldbook shelf keeps creation, upload, activation and location simple', () => {
  assert.match(worldbooks, /手动创建/);
  assert.match(worldbooks, /上传文件/);
  assert.match(worldbooks, /type="file" hidden multiple/);
  assert.match(worldbooks, /lorebooks\/import-collection/);
  assert.match(worldbooks, /JSON \/ DOCX \/ TXT \/ MD，可多选/);
  assert.match(worldbooks, /已启用 · \$\{scopeLabel\(book\)\}/);
  assert.match(worldbooks, /未启用/);
  assert.match(worldbooks, />名称</);
  assert.match(worldbooks, />使用位置</);
  assert.match(worldbooks, />启用</);
  assert.match(worldbooks, /触发方式（可选）/);
  assert.doesNotMatch(worldbooks, />扫描深度</);
  assert.doesNotMatch(worldbooks, />单轮预算</);
  assert.doesNotMatch(worldbooks, /允许关联设定继续唤醒/);
  assert.doesNotMatch(worldbooks, /导出备份/);
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
  assert.match(worldbooks, /worldbook-mobile-tabs/);
  assert.match(worldbookCss, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(worldbooks, />详情<\/button>/);
  assert.doesNotMatch(worldbooks, /书本设置|知识条目/);
  assert.match(rules, /theater-rule-mobile-tabs/);
  assert.doesNotMatch(rules, />添加规则<\/button>/);
  assert.match(worldbookCss, /worldbook-sidebar\.is-mobile-hidden/);
  assert.match(ruleCss, /theater-rule-list\.is-mobile-hidden/);
  assert.match(mobilePolish, /theater-rule-library-trigger:not\(\.is-memory\)/);
  assert.match(ruleCss, /@media \(max-width: 460px\)[\s\S]*\.theater-rule-editor-actions \{\s*grid-template-columns: 1fr/);
});
