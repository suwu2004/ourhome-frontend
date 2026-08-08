export const BOARD_SIZE = 15;
export const CENTER = Math.floor(BOARD_SIZE / 2);

const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];

export function inBounds(row, col) {
  return row >= 0 && col >= 0 && row < BOARD_SIZE && col < BOARD_SIZE;
}

export function boardFromMoves(moves = []) {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  for (const move of moves) {
    if (inBounds(move?.row, move?.col)) board[move.row][move.col] = move.actor;
  }
  return board;
}

function countDirection(board, row, col, dr, dc, actor) {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (inBounds(r, c) && board[r][c] === actor) {
    count += 1;
    r += dr;
    c += dc;
  }
  return { count, open: inBounds(r, c) && board[r][c] === null };
}

export function isWinningMove(board, row, col, actor) {
  return DIRECTIONS.some(([dr, dc]) => {
    const forward = countDirection(board, row, col, dr, dc, actor).count;
    const backward = countDirection(board, row, col, -dr, -dc, actor).count;
    return 1 + forward + backward >= 5;
  });
}

function firstActor(userColor) {
  return userColor === 'white' ? 'luze' : 'user';
}

function opposite(actor) {
  return actor === 'user' ? 'luze' : 'user';
}

export function sanitizeMoves(value, userColor = 'black') {
  if (!Array.isArray(value)) return [];
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  const occupied = new Set();
  const moves = [];
  let expected = firstActor(userColor);

  for (const item of value) {
    const row = Number(item?.row);
    const col = Number(item?.col);
    const actor = item?.actor === 'user' || item?.actor === 'luze' ? item.actor : '';
    const key = `${row}:${col}`;
    const valid = actor
      && actor === expected
      && Number.isInteger(row)
      && Number.isInteger(col)
      && inBounds(row, col)
      && !occupied.has(key);
    if (!valid) break;

    const move = { row, col, actor };
    moves.push(move);
    occupied.add(key);
    board[row][col] = actor;

    if (isWinningMove(board, row, col, actor)) break;
    expected = opposite(expected);
  }

  return moves;
}

export function terminalResult(moves = []) {
  if (!moves.length) return null;
  const last = moves.at(-1);
  const board = boardFromMoves(moves);
  if (last && isWinningMove(board, last.row, last.col, last.actor)) {
    return { winner: last.actor, reason: 'five' };
  }
  if (moves.length >= BOARD_SIZE * BOARD_SIZE) return { winner: 'draw', reason: 'board_full' };
  return null;
}

export function nextTurn(moves = [], userColor = 'black') {
  if (terminalResult(moves)) return 'done';
  const first = firstActor(userColor);
  return moves.length % 2 === 0 ? first : opposite(first);
}

function scoreLine(total, openEnds) {
  if (total >= 5) return 1_000_000;
  if (total === 4 && openEnds === 2) return 90_000;
  if (total === 4 && openEnds === 1) return 22_000;
  if (total === 3 && openEnds === 2) return 8_000;
  if (total === 3 && openEnds === 1) return 1_500;
  if (total === 2 && openEnds === 2) return 520;
  if (total === 2 && openEnds === 1) return 110;
  return openEnds ? 18 : 2;
}

function scoreCandidate(board, row, col, actor) {
  let score = 0;
  for (const [dr, dc] of DIRECTIONS) {
    const forward = countDirection(board, row, col, dr, dc, actor);
    const backward = countDirection(board, row, col, -dr, -dc, actor);
    score += scoreLine(1 + forward.count + backward.count, Number(forward.open) + Number(backward.open));
  }
  const distance = Math.abs(row - CENTER) + Math.abs(col - CENTER);
  return score + Math.max(0, 18 - distance);
}

function candidateCells(board, moves) {
  if (!moves.length) return [{ row: CENTER, col: CENTER }];
  const candidates = new Map();
  moves.forEach(move => {
    for (let dr = -2; dr <= 2; dr += 1) {
      for (let dc = -2; dc <= 2; dc += 1) {
        const row = move.row + dr;
        const col = move.col + dc;
        if (!inBounds(row, col) || board[row][col]) continue;
        candidates.set(`${row}:${col}`, { row, col });
      }
    }
  });
  return [...candidates.values()];
}

export function chooseLuzeMove(moves = []) {
  const board = boardFromMoves(moves);
  const candidates = candidateCells(board, moves);

  for (const cell of candidates) {
    board[cell.row][cell.col] = 'luze';
    const wins = isWinningMove(board, cell.row, cell.col, 'luze');
    board[cell.row][cell.col] = null;
    if (wins) return cell;
  }

  for (const cell of candidates) {
    board[cell.row][cell.col] = 'user';
    const blocks = isWinningMove(board, cell.row, cell.col, 'user');
    board[cell.row][cell.col] = null;
    if (blocks) return cell;
  }

  return candidates
    .map(cell => ({
      ...cell,
      score: scoreCandidate(board, cell.row, cell.col, 'luze') * 1.08
        + scoreCandidate(board, cell.row, cell.col, 'user'),
    }))
    .sort((a, b) => b.score - a.score
      || Math.abs(a.row - CENTER) + Math.abs(a.col - CENTER)
      - (Math.abs(b.row - CENTER) + Math.abs(b.col - CENTER)))[0] || null;
}

export function pointLabel(row, col) {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

export function runState(moves, turn, userColor, luzeColor) {
  return {
    board_size: BOARD_SIZE,
    moves,
    turn,
    user_color: userColor,
    luze_color: luzeColor,
    move_count: moves.length,
  };
}
