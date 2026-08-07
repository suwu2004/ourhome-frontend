import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import './ToyBoxRoom.css';

const HARMONY_STORE = 'ourhome_toybox_harmony_v1';
const SECRET_STORE = 'ourhome_toybox_secret_recent_v1';
const DRAWING_STORE = 'ourhome_toybox_drawing_recent_v1';
const CAT_STORE = 'ourhome_toybox_cat2048_v1';

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore storage failures */ }
}

async function postToybox(path, body = {}) {
  const response = await apiFetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || '这个小玩具暂时卡住了');
  return data;
}

function BearIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="18" cy="18" r="9" />
      <circle cx="46" cy="18" r="9" />
      <path d="M14 34c0-13 8-22 18-22s18 9 18 22-8 20-18 20-18-7-18-20Z" />
      <circle cx="25" cy="31" r="2.5" />
      <circle cx="39" cy="31" r="2.5" />
      <path d="M28 39c2.7 2.5 5.3 2.5 8 0M32 36v4" />
    </svg>
  );
}

const GAME_CARDS = [
  { key: 'harmony', icon: '💌', title: '默契大考验', note: '答案先锁住，再一起揭晓' },
  { key: 'cat2048', icon: '🐱', title: '猫猫 2048', note: '把小猫一路合成猫猫王' },
  { key: 'drawing', icon: '🎨', title: '你画我猜', note: '你负责鬼画符，陆泽负责猜' },
  { key: 'secret', icon: '🔐', title: '暗号猜猜', note: '每局随机，不被固定词库绑住' },
];

function HarmonyGame() {
  const [round, setRound] = useState(null);
  const [choice, setChoice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(() => readJson(HARMONY_STORE, { played: 0, matches: 0, recent: [] }));

  const loadRound = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setChoice('');
    try {
      const data = await postToybox('/toybox/harmony-round', { recent_questions: stats.recent || [] });
      setRound(data);
      const next = { ...stats, recent: [data.question, ...(stats.recent || [])].slice(0, 12) };
      setStats(next);
      writeJson(HARMONY_STORE, next);
    } catch (err) {
      setError(err.message || '题目没抽出来');
    } finally {
      setLoading(false);
    }
  }, [loading, stats]);

  useEffect(() => { if (!round && !loading && !error) loadRound(); }, [round, loading, error, loadRound]);

  const choose = value => {
    if (!round || choice) return;
    setChoice(value);
    const matched = value === round.luze_choice;
    const next = {
      ...stats,
      played: (stats.played || 0) + 1,
      matches: (stats.matches || 0) + (matched ? 1 : 0),
    };
    setStats(next);
    writeJson(HARMONY_STORE, next);
  };

  const rate = stats.played ? Math.round((stats.matches / stats.played) * 100) : 0;

  return (
    <section className="toy-game toy-harmony">
      <div className="toy-score-strip"><span>玩过 {stats.played || 0} 题</span><b>默契 {rate}%</b></div>
      {loading && <div className="toy-loading">陆泽正在偷偷锁答案……</div>}
      {error && <div className="toy-error"><p>{error}</p><button type="button" onClick={loadRound}>再抽一次</button></div>}
      {round && !loading && (
        <>
          <article className="toy-question-card">
            <small>THIS OR THAT</small>
            <h2>{round.question}</h2>
            <div className="toy-choice-grid">
              <button className={choice === 'A' ? 'is-picked' : ''} type="button" disabled={Boolean(choice)} onClick={() => choose('A')}><i>A</i><span>{round.option_a}</span></button>
              <button className={choice === 'B' ? 'is-picked' : ''} type="button" disabled={Boolean(choice)} onClick={() => choose('B')}><i>B</i><span>{round.option_b}</span></button>
            </div>
          </article>
          {choice && (
            <article className={`toy-reveal ${choice === round.luze_choice ? 'is-match' : 'is-different'}`}>
              <span>{choice === round.luze_choice ? '♡ 想到一起了' : '↯ 这次不一样'}</span>
              <p>你选了 <b>{choice}</b> · 陆泽选了 <b>{round.luze_choice}</b></p>
              <blockquote>{round.luze_comment}</blockquote>
              <button type="button" onClick={loadRound}>下一题</button>
            </article>
          )}
        </>
      )}
    </section>
  );
}

const CAT_TILES = {
  1: '🐾', 2: '🧶', 4: '🐟', 8: '🥫', 16: '🐱', 32: '😼',
  64: '🐈', 128: '🐈‍⬛', 256: '🏠', 512: '💗', 1024: '✨', 2048: '👑',
};

function emptyBoard() { return Array.from({ length: 4 }, () => Array(4).fill(0)); }
function cloneBoard(board) { return board.map(row => [...row]); }
function transpose(board) { return board[0].map((_, col) => board.map(row => row[col])); }

function collapseLine(line) {
  const values = line.filter(Boolean);
  const merged = [];
  let gained = 0;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === values[index + 1]) {
      const value = values[index] * 2;
      merged.push(value);
      gained += value;
      index += 1;
    } else merged.push(values[index]);
  }
  while (merged.length < 4) merged.push(0);
  return { line: merged, gained };
}

function moveBoard(board, direction) {
  let working = cloneBoard(board);
  let gained = 0;
  if (direction === 'up' || direction === 'down') working = transpose(working);
  const reverse = direction === 'right' || direction === 'down';
  working = working.map(row => {
    const input = reverse ? [...row].reverse() : row;
    const collapsed = collapseLine(input);
    gained += collapsed.gained;
    return reverse ? collapsed.line.reverse() : collapsed.line;
  });
  if (direction === 'up' || direction === 'down') working = transpose(working);
  return { board: working, gained };
}

function boardsEqual(left, right) {
  return left.every((row, r) => row.every((value, c) => value === right[r][c]));
}

function addRandomTile(board) {
  const empty = [];
  board.forEach((row, r) => row.forEach((value, c) => { if (!value) empty.push([r, c]); }));
  if (!empty.length) return board;
  const next = cloneBoard(board);
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  next[r][c] = Math.random() < 0.88 ? 1 : 2;
  return next;
}

function newCatGame() { return addRandomTile(addRandomTile(emptyBoard())); }

function hasMoves(board) {
  if (board.some(row => row.some(value => !value))) return true;
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (r < 3 && board[r][c] === board[r + 1][c]) return true;
      if (c < 3 && board[r][c] === board[r][c + 1]) return true;
    }
  }
  return false;
}

function Cat2048Game() {
  const saved = readJson(CAT_STORE, {});
  const [board, setBoard] = useState(() => Array.isArray(saved.board) ? saved.board : newCatGame());
  const [score, setScore] = useState(() => Number(saved.score) || 0);
  const [best, setBest] = useState(() => Number(saved.best) || 0);
  const touchStart = useRef(null);

  const persist = useCallback((nextBoard, nextScore, nextBest) => {
    writeJson(CAT_STORE, { board: nextBoard, score: nextScore, best: nextBest });
  }, []);

  const move = useCallback(direction => {
    const result = moveBoard(board, direction);
    if (boardsEqual(result.board, board)) return;
    const nextBoard = addRandomTile(result.board);
    const nextScore = score + result.gained;
    const nextBest = Math.max(best, nextScore);
    setBoard(nextBoard);
    setScore(nextScore);
    setBest(nextBest);
    persist(nextBoard, nextScore, nextBest);
  }, [board, score, best, persist]);

  useEffect(() => {
    const onKey = event => {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (!map[event.key]) return;
      event.preventDefault();
      move(map[event.key]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const reset = () => {
    const next = newCatGame();
    setBoard(next);
    setScore(0);
    persist(next, 0, best);
  };

  const onTouchEnd = event => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  };

  return (
    <section className="toy-game toy-cat2048">
      <div className="toy-score-strip"><span>分数 {score}</span><b>最高 {best}</b></div>
      <div
        className="cat-board"
        onTouchStart={event => { const t = event.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; }}
        onTouchEnd={onTouchEnd}
      >
        {board.flatMap((row, r) => row.map((value, c) => (
          <div className={`cat-tile cat-tile--${value || 0}`} key={`${r}-${c}`}><span>{value ? (CAT_TILES[value] || '🐱') : ''}</span></div>
        )))}
      </div>
      <p className="toy-help">手机上下左右滑，电脑也可以用方向键。</p>
      {!hasMoves(board) && <div className="toy-gameover"><b>猫猫挤满啦。</b><span>这局 {score} 分</span></div>}
      <button className="toy-secondary" type="button" onClick={reset}>重新开一局</button>
    </section>
  );
}

function DrawingGame() {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [prompt, setPrompt] = useState(null);
  const [guess, setGuess] = useState(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [error, setError] = useState('');
  const [eraser, setEraser] = useState(false);
  const [recent, setRecent] = useState(() => readJson(DRAWING_STORE, []));

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.fillStyle = '#fffaf1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    setGuess(null);
  }, []);

  useEffect(() => { resetCanvas(); }, [resetCanvas]);

  const pointFor = event => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = event => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFor(event);
  };

  const draw = event => {
    if (!drawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const next = pointFor(event);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = eraser ? 22 : 6;
    ctx.strokeStyle = eraser ? '#fffaf1' : '#744314';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(next.x, next.y);
    ctx.stroke();
    lastPointRef.current = next;
  };

  const stopDraw = () => { drawingRef.current = false; lastPointRef.current = null; };

  const newPrompt = async () => {
    if (loadingPrompt) return;
    setLoadingPrompt(true);
    setError('');
    setGuess(null);
    try {
      const data = await postToybox('/toybox/drawing-prompt', { recent_prompts: recent });
      setPrompt(data);
      const next = [data.prompt, ...recent].slice(0, 12);
      setRecent(next);
      writeJson(DRAWING_STORE, next);
      resetCanvas();
    } catch (err) {
      setError(err.message || '题目没抽出来');
    } finally {
      setLoadingPrompt(false);
    }
  };

  const askGuess = async () => {
    if (guessing || !canvasRef.current) return;
    setGuessing(true);
    setError('');
    try {
      const data = await postToybox('/toybox/guess-drawing', { image: canvasRef.current.toDataURL('image/png') });
      setGuess(data);
    } catch (err) {
      setError(err.message || '陆泽这次没看懂');
    } finally {
      setGuessing(false);
    }
  };

  return (
    <section className="toy-game toy-drawing">
      <div className="drawing-prompt">
        {prompt ? <><small>偷偷看题</small><b>{prompt.prompt}</b><p>{prompt.tease}</p></> : <><small>DRAW & GUESS</small><b>随便画，或者让陆泽出题</b></>}
        <button type="button" onClick={newPrompt} disabled={loadingPrompt}>{loadingPrompt ? '抽题中…' : prompt ? '换一道' : '给我出题'}</button>
      </div>
      <canvas
        ref={canvasRef}
        className="toy-canvas"
        width="640"
        height="460"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={stopDraw}
        onPointerCancel={stopDraw}
        onPointerLeave={stopDraw}
      />
      <div className="drawing-tools">
        <button type="button" className={eraser ? 'is-active' : ''} onClick={() => setEraser(value => !value)}>{eraser ? '✎ 画笔' : '⌫ 橡皮'}</button>
        <button type="button" onClick={resetCanvas}>清空</button>
        <button className="toy-primary" type="button" onClick={askGuess} disabled={guessing}>{guessing ? '陆泽在看……' : '让陆泽猜'}</button>
      </div>
      {error && <p className="toy-inline-error">{error}</p>}
      {guess && <article className="drawing-guess"><small>陆泽猜</small><h3>{guess.guess}</h3><p>{guess.comment}</p><span>把握：{guess.confidence === 'high' ? '很大' : guess.confidence === 'low' ? '不太大' : '一半一半'}</span></article>}
    </section>
  );
}

function guessFeedback(answer, guess) {
  const answerChars = [...answer];
  return [...guess].map((char, index) => ({
    char,
    status: answerChars[index] === char ? 'exact' : answerChars.includes(char) ? 'present' : 'miss',
  }));
}

function SecretGame() {
  const [round, setRound] = useState(null);
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(() => readJson(SECRET_STORE, []));

  const newRound = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setInput('');
    setGuesses([]);
    try {
      const data = await postToybox('/toybox/secret-round', { recent_answers: recent });
      setRound(data);
      const next = [data.answer, ...recent].slice(0, 16);
      setRecent(next);
      writeJson(SECRET_STORE, next);
    } catch (err) {
      setError(err.message || '暗号没藏好');
    } finally {
      setLoading(false);
    }
  }, [loading, recent]);

  useEffect(() => { if (!round && !loading && !error) newRound(); }, [round, loading, error, newRound]);

  const won = Boolean(round && guesses.some(item => item.value === round.answer));
  const finished = won || guesses.length >= 6;

  const submit = event => {
    event.preventDefault();
    if (!round || finished) return;
    const value = input.replace(/\s+/g, '').trim();
    if (!value) return;
    if (guesses.some(item => item.value === value)) { setInput(''); return; }
    setGuesses(items => [...items, { value, feedback: guessFeedback(round.answer, value) }]);
    setInput('');
  };

  return (
    <section className="toy-game toy-secret">
      {loading && <div className="toy-loading">陆泽正在藏一个谁也想不到的词……</div>}
      {error && <div className="toy-error"><p>{error}</p><button type="button" onClick={newRound}>重新藏</button></div>}
      {round && !loading && (
        <>
          <article className="secret-clue"><small>分类 · {round.category}</small><h2>{'□'.repeat(Math.min([...round.answer].length, 8))}</h2><p>提示一：{round.hint1}</p>{guesses.length >= 3 && !finished && <p>提示二：{round.hint2}</p>}</article>
          <div className="secret-history">
            {guesses.map((guess, index) => (
              <div className="secret-guess" key={`${guess.value}-${index}`}>
                <span className="secret-number">{index + 1}</span>
                <div>{guess.feedback.map((item, charIndex) => <i className={`is-${item.status}`} key={`${item.char}-${charIndex}`}>{item.char}</i>)}</div>
                {guess.value.length !== round.answer.length && <small>长度不一样</small>}
              </div>
            ))}
          </div>
          {!finished && (
            <form className="secret-form" onSubmit={submit}>
              <input value={input} onChange={event => setInput(event.target.value)} placeholder={`第 ${guesses.length + 1}/6 次猜`} maxLength={12} autoComplete="off" />
              <button type="submit">猜</button>
            </form>
          )}
          {finished && <article className={`secret-result ${won ? 'is-win' : ''}`}><span>{won ? '✦ 猜中了' : '答案揭晓'}</span><h3>{round.answer}</h3><p>{round.reveal_comment}</p><button type="button" onClick={newRound}>再藏一个</button></article>}
        </>
      )}
    </section>
  );
}

export default function ToyBoxRoom({ onClose }) {
  const { darkMode } = useTheme();
  const [activeGame, setActiveGame] = useState(null);
  const game = useMemo(() => GAME_CARDS.find(item => item.key === activeGame), [activeGame]);

  return (
    <main className={`toybox-room ${darkMode ? 'toybox-room--night' : ''}`}>
      <div className="toybox-glow" aria-hidden="true"><i /><i /><i /></div>
      <header className="toybox-header">
        <button className="toybox-back" type="button" onClick={() => activeGame ? setActiveGame(null) : onClose()} aria-label={activeGame ? '返回玩具箱' : '返回主页'}>←</button>
        <div className="toybox-title">
          <span className="toybox-bear"><BearIcon /></span>
          <div><small>OUR LITTLE TOYBOX</small><h1>{game?.title || '玩具箱'}</h1></div>
        </div>
        <span className="toybox-header-star">✦</span>
      </header>

      {!activeGame && (
        <section className="toybox-shelf">
          <p>今天从哪一个开始捣乱？</p>
          <div className="toybox-game-grid">
            {GAME_CARDS.map(item => (
              <button key={item.key} type="button" className={`toybox-game-card toybox-game-card--${item.key}`} onClick={() => setActiveGame(item.key)}>
                <span>{item.icon}</span><strong>{item.title}</strong><small>{item.note}</small><i>打开 →</i>
              </button>
            ))}
          </div>
          <div className="toybox-footnote">四个玩具各玩各的，不会往 Chat 里塞游戏消息。</div>
        </section>
      )}

      {activeGame === 'harmony' && <HarmonyGame />}
      {activeGame === 'cat2048' && <Cat2048Game />}
      {activeGame === 'drawing' && <DrawingGame />}
      {activeGame === 'secret' && <SecretGame />}
    </main>
  );
}
