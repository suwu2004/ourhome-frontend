import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  boardFromMoves,
  chooseLuzeMove,
  nextTurn,
  sanitizeMoves,
  terminalResult,
} from '../src/gomokuEngine.js';

test('corrupted consecutive Luze moves are truncated at the last legal turn', () => {
  const raw = [
    { row: 7, col: 7, actor: 'user' },
    { row: 7, col: 8, actor: 'luze' },
    { row: 7, col: 9, actor: 'luze' },
    { row: 7, col: 10, actor: 'luze' },
  ];
  const safe = sanitizeMoves(raw, 'black');
  assert.deepEqual(safe, raw.slice(0, 2));
  assert.equal(nextTurn(safe, 'black'), 'user');
});

test('a normal user move gives exactly one Luze turn and one Luze move returns the turn', () => {
  const userMoves = sanitizeMoves([{ row: 7, col: 7, actor: 'user' }], 'black');
  assert.equal(nextTurn(userMoves, 'black'), 'luze');

  const cell = chooseLuzeMove(userMoves);
  assert.ok(cell);
  const afterLuze = sanitizeMoves([...userMoves, { ...cell, actor: 'luze' }], 'black');
  assert.equal(afterLuze.length, 2);
  assert.equal(nextTurn(afterLuze, 'black'), 'user');
});

test('Luze-black invitation starts in the center and correctly hands the turn to the user', () => {
  const moves = sanitizeMoves([{ row: 7, col: 7, actor: 'luze' }], 'white');
  assert.equal(moves.length, 1);
  assert.equal(nextTurn(moves, 'white'), 'user');
});

test('five in a row ends the game and ignores all moves that follow', () => {
  const raw = [
    { row: 3, col: 3, actor: 'user' },
    { row: 0, col: 0, actor: 'luze' },
    { row: 3, col: 4, actor: 'user' },
    { row: 0, col: 1, actor: 'luze' },
    { row: 3, col: 5, actor: 'user' },
    { row: 0, col: 2, actor: 'luze' },
    { row: 3, col: 6, actor: 'user' },
    { row: 1, col: 0, actor: 'luze' },
    { row: 3, col: 7, actor: 'user' },
    { row: 1, col: 1, actor: 'luze' },
  ];
  const safe = sanitizeMoves(raw, 'black');
  assert.equal(safe.length, 9);
  assert.deepEqual(terminalResult(safe), { winner: 'user', reason: 'five' });
  assert.equal(nextTurn(safe, 'black'), 'done');
});

test('board helper remains 15x15', () => {
  const board = boardFromMoves([]);
  assert.equal(board.length, BOARD_SIZE);
  assert.ok(board.every(row => row.length === BOARD_SIZE));
});
