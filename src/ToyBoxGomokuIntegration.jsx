import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import './ToyBoxGomoku.css';

const BOARD_SIZE = 15;
const CENTER = Math.floor(BOARD_SIZE / 2);
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const LOCAL_RUN_STORE = 'ourhome_gomoku_local_run_v1';
const LOCAL_RUN_PREFIX = 'local-gomoku-';

async function requestJson(path, options = {}) {
  const response = await apiFetch(`${BACKEND}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || '五子棋暂时卡住了');
  return data;
}

async function postJson(path, body = {}) {
  return requestJson(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function patchJson(path, body = {}) {
  return requestJson(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function isLocalRunId(value) {
  return String(value || '').startsWith(LOCAL_RUN_PREFIX);
}

function readLocalRun() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_RUN_STORE) || 'null');
    return parsed?.id && isLocalRunId(parsed.id) ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalRun(run) {
  try {
    if (!run) localStorage.removeItem(LOCAL_RUN_STORE);
    else localStorage.setItem(LOCAL_RUN_STORE, JSON.stringify(run));
  } catch { /* local play should never fail because storage is unavailable */ }
}

function validMoves(value) {
  if (!Array.isArray(value)) return [];
  const occupied = new Set();
  return value.flatMap(item => {
    const row = Number(item?.row);
    const col = Number(item?.col);
    const actor = item?.actor === 'luze' ? 'luze' : item?.actor === 'user' ? 'user' : null;
    const key = `${row}:${col}`;
    if (!actor || !Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= BOARD_SIZE || col >= BOARD_SIZE || occupied.has(key)) return [];
    occupied.add(key);
    return [{ row, col, actor }];
  });
}

function boardFromMoves(moves) {
  const board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
  moves.forEach(move => { board[move.row][move.col] = move.actor; });
  return board;
}

function inBounds(row, col) {
  return row >= 0 && col >= 0 && row < BOARD_SIZE && col < BOARD_SIZE;
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

function isWinningMove(board, row, col, actor) {
  return DIRECTIONS.some(([dr, dc]) => {
    const forward = countDirection(board, row, col, dr, dc, actor).count;
    const backward = countDirection(board, row, col, -dr, -dc, actor).count;
    return 1 + forward + backward >= 5;
  });
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

function chooseLuzeMove(moves) {
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
    .sort((a, b) => b.score - a.score || Math.abs(a.row - CENTER) + Math.abs(a.col - CENTER) - (Math.abs(b.row - CENTER) + Math.abs(b.col - CENTER)))[0] || null;
}

function pointLabel(row, col) {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function runState(moves, turn, userColor, luzeColor) {
  return {
    board_size: BOARD_SIZE,
    moves,
    turn,
    user_color: userColor,
    luze_color: luzeColor,
    move_count: moves.length,
  };
}

function makeLocalRun({ moves = [], turn = 'user', userColor = 'black', luzeColor = 'white', status = 'active', result = {}, title = '' } = {}) {
  return {
    id: `${LOCAL_RUN_PREFIX}${Date.now()}`,
    game: 'gomoku',
    initiator: 'user',
    status,
    title: title || `五子棋 · ${userColor === 'black' ? '你执黑' : '陆泽执黑'}`,
    state: runState(moves, turn, userColor, luzeColor),
    result,
  };
}

function GomokuGame({ initialRun, onClose, onRefresh }) {
  const installedRunRef = useRef('');
  const creatingRef = useRef(false);
  const [runId, setRunId] = useState('');
  const [moves, setMoves] = useState([]);
  const [turn, setTurn] = useState('user');
  const [userColor, setUserColor] = useState('black');
  const [luzeColor, setLuzeColor] = useState('white');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [localNotice, setLocalNotice] = useState('');

  const board = useMemo(() => boardFromMoves(moves), [moves]);
  const lastMove = moves.at(-1) || null;
  const localOnly = isLocalRunId(runId);

  const installRun = useCallback(run => {
    if (!run?.id) return;
    installedRunRef.current = String(run.id);
    const state = run.state || {};
    setRunId(String(run.id));
    setMoves(validMoves(state.moves));
    setTurn(state.turn === 'luze' ? 'luze' : state.turn === 'done' ? 'done' : 'user');
    setUserColor(state.user_color === 'white' ? 'white' : 'black');
    setLuzeColor(state.luze_color === 'black' ? 'black' : 'white');
    setStatus(run.status === 'completed' ? 'completed' : 'active');
    setResult(run.result || {});
    setLocalNotice(isLocalRunId(run.id) ? '云端记录暂时没接上，这盘先在本机下，不影响对弈。' : '');
    setError('');
  }, []);

  useEffect(() => {
    if (!initialRun?.id || installedRunRef.current === String(initialRun.id)) return;
    installRun(initialRun);
  }, [initialRun, installRun]);

  const startNew = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (runId && status === 'active' && !isLocalRunId(runId)) {
        await patchJson(`/toybox/runs/${runId}`, { status: 'abandoned' }).catch(() => null);
      }
      writeLocalRun(null);
      const state = runState([], 'user', 'black', 'white');
      try {
        const run = await postJson('/toybox/runs', {
          game: 'gomoku',
          status: 'active',
          initiator: 'user',
          title: '五子棋 · 你执黑',
          state,
        });
        installRun(run);
        onRefresh?.();
      } catch (cloudError) {
        console.warn('Gomoku cloud record unavailable, using local game:', cloudError.message);
        const local = makeLocalRun();
        writeLocalRun(local);
        installRun(local);
      }
    } finally {
      creatingRef.current = false;
      setBusy(false);
    }
  }, [installRun, onRefresh, runId, status]);

  useEffect(() => {
    if (initialRun?.id || runId || status !== 'idle') return;
    const local = readLocalRun();
    if (local?.status === 'active') {
      installRun(local);
      return;
    }
    startNew();
  }, [initialRun, installRun, runId, startNew, status]);

  const persistMove = useCallback(async (actor, move, nextMoves, nextTurn) => {
    if (!runId) return;
    if (isLocalRunId(runId)) {
      writeLocalRun({
        id: runId,
        game: 'gomoku',
        initiator: 'user',
        status: 'active',
        title: `五子棋 · ${userColor === 'black' ? '你执黑' : '陆泽执黑'}`,
        state: runState(nextMoves, nextTurn, userColor, luzeColor),
        result: {},
      });
      return;
    }
    await Promise.all([
      postJson(`/toybox/runs/${runId}/events`, {
        actor,
        event_type: '落子',
        payload: { row: move.row, col: move.col, title: `${actor === 'luze' ? '陆泽' : '你'} · ${pointLabel(move.row, move.col)}` },
      }),
      patchJson(`/toybox/runs/${runId}`, {
        state: runState(nextMoves, nextTurn, userColor, luzeColor),
      }),
    ]);
  }, [luzeColor, runId, userColor]);

  const completeRun = useCallback(async (winner, finalMoves, reason = 'five') => {
    const finalResult = {
      winner,
      reason,
      move_count: finalMoves.length,
      user_color: userColor,
      luze_color: luzeColor,
    };
    setStatus('completed');
    setResult(finalResult);
    if (!runId) return;
    if (isLocalRunId(runId)) {
      writeLocalRun({
        id: runId,
        game: 'gomoku',
        initiator: 'user',
        status: 'completed',
        title: `五子棋 · ${userColor === 'black' ? '你执黑' : '陆泽执黑'}`,
        state: runState(finalMoves, 'done', userColor, luzeColor),
        result: finalResult,
      });
      return;
    }
    await patchJson(`/toybox/runs/${runId}`, {
      status: 'completed',
      state: runState(finalMoves, 'done', userColor, luzeColor),
      result: finalResult,
    });
    onRefresh?.();
  }, [luzeColor, onRefresh, runId, userColor]);

  const placeUser = async (row, col) => {
    if (status !== 'active' || turn !== 'user' || busy || board[row][col]) return;
    setBusy(true);
    setError('');
    const move = { row, col, actor: 'user' };
    const nextMoves = [...moves, move];
    const nextBoard = boardFromMoves(nextMoves);
    setMoves(nextMoves);
    try {
      if (isWinningMove(nextBoard, row, col, 'user')) {
        await persistMove('user', move, nextMoves, 'done');
        await completeRun('user', nextMoves);
        setTurn('done');
      } else if (nextMoves.length >= BOARD_SIZE * BOARD_SIZE) {
        await persistMove('user', move, nextMoves, 'done');
        await completeRun('draw', nextMoves, 'board_full');
        setTurn('done');
      } else {
        await persistMove('user', move, nextMoves, 'luze');
        setTurn('luze');
      }
    } catch (err) {
      setError(err.message || '这一手没有保存好');
      setTurn('luze');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (status !== 'active' || turn !== 'luze' || !runId) return undefined;
    let cancelled = false;
    setBusy(true);
    const timer = window.setTimeout(async () => {
      const cell = chooseLuzeMove(moves);
      if (!cell || cancelled) { setBusy(false); return; }
      const move = { ...cell, actor: 'luze' };
      const nextMoves = [...moves, move];
      const nextBoard = boardFromMoves(nextMoves);
      setMoves(nextMoves);
      try {
        if (isWinningMove(nextBoard, move.row, move.col, 'luze')) {
          await persistMove('luze', move, nextMoves, 'done');
          if (!cancelled) {
            await completeRun('luze', nextMoves);
            setTurn('done');
          }
        } else if (nextMoves.length >= BOARD_SIZE * BOARD_SIZE) {
          await persistMove('luze', move, nextMoves, 'done');
          if (!cancelled) {
            await completeRun('draw', nextMoves, 'board_full');
            setTurn('done');
          }
        } else {
          await persistMove('luze', move, nextMoves, 'user');
          if (!cancelled) setTurn('user');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || '陆泽这一步没有保存好');
          setTurn('user');
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 520);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [completeRun, moves, persistMove, runId, status, turn]);

  const undo = async () => {
    if (busy || status !== 'active' || turn !== 'user' || !moves.some(move => move.actor === 'user')) return;
    let cut = moves.length;
    if (moves[cut - 1]?.actor === 'luze' && moves[cut - 2]?.actor === 'user') cut -= 2;
    else if (moves[cut - 1]?.actor === 'user') cut -= 1;
    const nextMoves = moves.slice(0, Math.max(0, cut));
    setMoves(nextMoves);
    setBusy(true);
    try {
      if (localOnly) {
        writeLocalRun({
          id: runId,
          game: 'gomoku',
          initiator: 'user',
          status: 'active',
          title: `五子棋 · ${userColor === 'black' ? '你执黑' : '陆泽执黑'}`,
          state: runState(nextMoves, 'user', userColor, luzeColor),
          result: {},
        });
      } else {
        await Promise.all([
          postJson(`/toybox/runs/${runId}/events`, { actor: 'user', event_type: '悔棋', payload: { title: '你悄悄撤回了一轮 👿' } }),
          patchJson(`/toybox/runs/${runId}`, { state: runState(nextMoves, 'user', userColor, luzeColor) }),
        ]);
      }
      setTurn('user');
    } catch (err) {
      setError(err.message || '悔棋没保存好');
    } finally {
      setBusy(false);
    }
  };

  const surrender = async () => {
    if (busy || status !== 'active') return;
    setBusy(true);
    try {
      if (!localOnly) {
        await postJson(`/toybox/runs/${runId}/events`, { actor: 'user', event_type: '认输', payload: { title: '你把棋盘推给陆泽了' } });
      }
      await completeRun('luze', moves, 'surrender');
      setTurn('done');
    } catch (err) {
      setError(err.message || '这局还没收好');
    } finally {
      setBusy(false);
    }
  };

  const statusText = status === 'completed'
    ? result.winner === 'user' ? '你赢了。可以嘲笑他了 👿'
      : result.winner === 'luze' ? (result.reason === 'surrender' ? '这盘算陆泽赢。哼。' : '陆泽连成五个了。👿')
        : '棋盘下满，平局。'
    : turn === 'luze' ? '陆泽在落子……'
      : userColor === 'black' && moves.length === 0 ? '你执黑，先手。' : '轮到你。';

  return (
    <section className="gomoku-overlay" aria-label="五子棋">
      <header className="gomoku-header">
        <button type="button" onClick={onClose}>←</button>
        <div><small>PIXEL GOMOKU</small><h2>五子棋</h2></div>
        <span>● ○</span>
      </header>

      <div className="gomoku-status-card">
        <div><span className={`gomoku-mini-stone is-${userColor}`} />你 · {userColor === 'black' ? '黑' : '白'}</div>
        <b>{statusText}</b>
        <div><span className={`gomoku-mini-stone is-${luzeColor}`} />陆泽 · {luzeColor === 'black' ? '黑' : '白'}</div>
      </div>

      <div className="gomoku-board-shell">
        <div className="gomoku-board" role="grid" aria-label="15乘15五子棋棋盘">
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
            const row = Math.floor(index / BOARD_SIZE);
            const col = index % BOARD_SIZE;
            const actor = board[row][col];
            const color = actor === 'user' ? userColor : actor === 'luze' ? luzeColor : '';
            const isLast = lastMove?.row === row && lastMove?.col === col;
            return (
              <button
                type="button"
                role="gridcell"
                aria-label={`${pointLabel(row, col)}${actor ? ` ${actor === 'user' ? '你的棋子' : '陆泽的棋子'}` : ''}`}
                className={`gomoku-cell ${isLast ? 'is-last' : ''}`}
                key={`${row}-${col}`}
                disabled={Boolean(actor) || turn !== 'user' || status !== 'active' || busy}
                onClick={() => placeUser(row, col)}
              >
                {actor && <span className={`gomoku-stone is-${color}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {localNotice && <p className="gomoku-error">{localNotice}</p>}
      {error && <p className="gomoku-error">{error}</p>}
      <div className="gomoku-controls">
        <button type="button" onClick={undo} disabled={busy || status !== 'active' || turn !== 'user' || !moves.some(move => move.actor === 'user')}>悔一步</button>
        <button type="button" onClick={surrender} disabled={busy || status !== 'active'}>认输</button>
        <button type="button" className="is-primary" onClick={startNew} disabled={busy}>再来一盘</button>
      </div>
      <p className="gomoku-footnote">棋力始终在本地计算，不会每落一子调用模型。云端正常时棋谱和输赢会写进记录册；云端断开时照样能下，这盘先保存在本机。</p>
    </section>
  );
}

function useGameGridTarget() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    let observer;
    const locate = () => {
      const next = document.querySelector('.toybox-game-grid');
      if (next) setTarget(current => current === next ? current : next);
      return Boolean(next);
    };
    locate();
    observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return target && document.body.contains(target) ? target : null;
}

export default function ToyBoxGomokuIntegration() {
  const gridTarget = useGameGridTarget();
  const [openRuns, setOpenRuns] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [localResume, setLocalResume] = useState(() => {
    const run = readLocalRun();
    return run?.status === 'active' ? run : null;
  });

  const refreshOpen = useCallback(async () => {
    try {
      const data = await requestJson('/toybox/open');
      setOpenRuns(Array.isArray(data?.runs) ? data.runs : []);
    } catch {
      setOpenRuns([]);
    }
    const local = readLocalRun();
    setLocalResume(local?.status === 'active' ? local : null);
  }, []);

  useEffect(() => {
    refreshOpen();
    const timer = window.setInterval(refreshOpen, 4000);
    return () => window.clearInterval(timer);
  }, [refreshOpen]);

  const invitation = openRuns.find(run => run.game === 'gomoku' && run.initiator === 'luze' && run.status === 'invited') || null;
  const resumable = openRuns.find(run => run.game === 'gomoku' && run.status === 'active') || localResume || null;

  useEffect(() => {
    document.body.classList.toggle('toybox-gomoku-invite-active', Boolean(invitation));
    return () => document.body.classList.remove('toybox-gomoku-invite-active');
  }, [invitation]);

  const openFromShelf = () => {
    setSelectedRun(resumable || null);
    setOpen(true);
  };

  const acceptInvitation = async () => {
    if (!invitation) return;
    setInviteError('');
    try {
      const run = await patchJson(`/toybox/runs/${invitation.id}`, { status: 'active' });
      setSelectedRun(run);
      setOpen(true);
      await refreshOpen();
    } catch (err) {
      console.warn('Gomoku invitation cloud accept failed, continuing locally:', err.message);
      const firstMove = { row: CENTER, col: CENTER, actor: 'luze' };
      const local = makeLocalRun({
        moves: [firstMove],
        turn: 'user',
        userColor: 'white',
        luzeColor: 'black',
        title: '五子棋 · 陆泽执黑',
      });
      writeLocalRun(local);
      setLocalResume(local);
      setSelectedRun(local);
      setOpen(true);
      setInviteError('');
    }
  };

  return (
    <>
      {gridTarget && createPortal(
        <button type="button" className="toybox-game-card toybox-game-card--gomoku" onClick={openFromShelf}>
          <span>⚫</span><strong>五子棋</strong><small>15×15，和陆泽狠狠干一盘</small><i>{resumable ? '继续 →' : '打开 →'}</i>
        </button>,
        gridTarget,
      )}

      {invitation && !open && createPortal(
        <section className="gomoku-invite-float">
          <span>⚫</span><div><small>陆泽已经先落了一颗</small><b>{invitation.title || '五子棋 · 陆泽执黑'}</b>{inviteError && <em>{inviteError}</em>}</div><button type="button" onClick={acceptInvitation}>接招 👿</button>
        </section>,
        document.body,
      )}

      {open && createPortal(
        <GomokuGame
          initialRun={selectedRun}
          onClose={() => { setOpen(false); setSelectedRun(null); refreshOpen(); }}
          onRefresh={refreshOpen}
        />,
        document.body,
      )}
    </>
  );
}
