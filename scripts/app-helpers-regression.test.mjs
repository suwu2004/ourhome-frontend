import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeModelOptions,
  normalizeCalendarDayColors,
  newestFirst,
  oldestFirst,
  formatMsgTime,
  mapDbMessage,
  shanghaiDateKey,
  createRequestError,
  isModelUnavailableError,
  isVisionUnavailableError,
  isEmptyModelResponseError,
  friendlyGenerationError,
} from '../src/appHelpers.js';

test('model options keep the preferred model first and remove empty duplicates', () => {
  assert.deepEqual(normalizeModelOptions(['a', 'b', 'a', ''], ' b '), ['b', 'a']);
});

test('calendar colors accept only date keys and six-digit hex values', () => {
  assert.deepEqual(normalizeCalendarDayColors({
    '2026-11-03': '#aabbcc',
    '2026-2-03': '#ffffff',
    '2026-11-04': 'red',
    'not-a-date': '#112233',
  }), { '2026-11-03': '#AABBCC' });
});

test('message sort helpers return sorted copies without mutating source arrays', () => {
  const rows = [{ id: 1, created_at: '2026-11-02T10:00:00Z' }, { id: 2, created_at: '2026-11-03T10:00:00Z' }];
  assert.deepEqual(newestFirst(rows).map(row => row.id), [2, 1]);
  assert.deepEqual(oldestFirst(rows).map(row => row.id), [1, 2]);
  assert.deepEqual(rows.map(row => row.id), [1, 2]);
});

test('message mapper preserves attachments, thinking, tokens and local display time', () => {
  const date = new Date(2026, 10, 3, 9, 5);
  assert.equal(formatMsgTime(date), '09:05');
  assert.equal(formatMsgTime('not-a-date'), '');
  assert.deepEqual(mapDbMessage({
    id: 7,
    role: 'user',
    content: 'hello',
    attachment_url: 'https://example.test/photo.png',
    attachment_type: 'image/png',
    attachment_name: 'photo.png',
    reasoning_content: 'thinking',
    input_tokens: 120,
    output_tokens: 8,
    created_at: date.toISOString(),
  }), {
    id: 7,
    role: 'me',
    text: 'hello',
    image: 'https://example.test/photo.png',
    file: null,
    thinking: 'thinking',
    inputTokens: 120,
    outputTokens: 8,
    thinkingOpen: false,
    createdAt: date.toISOString(),
    time: '09:05',
  });
  const file = mapDbMessage({
    id: 8,
    role: 'assistant',
    content: 'file',
    attachment_url: 'https://example.test/notes.pdf',
    attachment_type: 'application/pdf',
    attachment_name: 'notes.pdf',
    created_at: date.toISOString(),
  });
  assert.equal(file.role, 'ai');
  assert.deepEqual(file.file, { url: 'https://example.test/notes.pdf', name: 'notes.pdf' });
  assert.equal(file.image, null);
});

test('Shanghai date keys follow China time across UTC date boundaries', () => {
  assert.equal(shanghaiDateKey('2026-11-02T16:30:00.000Z'), '2026-11-03');
  assert.equal(shanghaiDateKey('2026-11-03T15:59:00.000Z'), '2026-11-03');
  assert.equal(shanghaiDateKey('invalid'), '');
});

test('request errors retain machine-readable code and model information', () => {
  const error = createRequestError({ error: 'upstream failed', code: 'vision_unavailable', model: 'vision-x' }, 'fallback');
  assert.equal(error.message, 'upstream failed');
  assert.equal(error.code, 'vision_unavailable');
  assert.equal(error.model, 'vision-x');
  assert.equal(isVisionUnavailableError(error), true);
  assert.equal(isVisionUnavailableError({ code: 'other' }), false);
});

test('model failure classification and friendly messages remain stable', () => {
  assert.equal(isModelUnavailableError({ message: 'unknown model on this endpoint' }), true);
  assert.equal(isModelUnavailableError({ code: 'MODEL_UNAVAILABLE' }), true);
  assert.equal(isEmptyModelResponseError({ code: 'empty_model_response' }), true);
  assert.equal(isEmptyModelResponseError({ message: '模型返回了空正文' }), true);
  assert.equal(friendlyGenerationError({ code: 'empty_model_response' }, '重新生成'), '模型这次没有返回正文。消息还在，直接重新生成就好。');
  assert.equal(friendlyGenerationError({ message: 'network down' }), 'network down');
});
