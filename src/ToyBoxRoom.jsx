import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import './ToyBoxRoom.css';

const HARMONY_STORE = 'ourhome_toybox_harmony_v1';
const HARMONY_QUEUE_STORE = 'ourhome_toybox_harmony_queue_v2';
const SECRET_STORE = 'ourhome_toybox_secret_recent_v1';
const SECRET_QUEUE_STORE = 'ourhome_toybox_secret_queue_v2';
const DRAWING_STORE = 'ourhome_toybox_drawing_recent_v1';
const DRAWING_QUEUE_STORE = 'ourhome_toybox_drawing_queue_v2';
const MODEL_STORE = 'ourhome_toybox_budget_model_v1';

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

function readString(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function writeString(key, value) {
  try { localStorage.setItem(key, value || ''); } catch { /* ignore storage failures */ }
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

async function fetchToyboxModels() {
  const response = await apiFetch(`${BACKEND}/settings/models`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || '模型列表暂时没拿到');
  return Array.isArray(data?.models) ? data.models.map(String).filter(Boolean) : [];
}

function isToyboxModelCandidate(model) {
  const value = String(model || '').toLowerCase();
  if (!value) return false;
  return !/(embedding|rerank|tts|whisper|audio|image[-_ ]?gen|dall[-_ ]?e|stable[-_ ]?diffusion|moderation|ocr|transcrib)/i.test(value);
}

function explicitPriceHint(model) {
  const value = String(model || '').toLowerCase();
  const matches = [...value.matchAll(/(?:^|[-_\[(（])(?:x|price|cost)?\s*(0\.\d{1,4})(?=[\])）_\-])/g)]
    .map(match => Number(match[1]))
    .filter(number => Number.isFinite(number) && number > 0 && number < 1);
  return matches.length ? Math.min(...matches) : null;
}

function budgetScore(model) {
  const value = String(model || '').toLowerCase();
  const explicit = explicitPriceHint(value);
  if (explicit !== null) return explicit;
  let score = 50;
  if (/flash[-_ ]?lite|nano/.test(value)) score = 1;
  else if (/haiku|mini|lite|small/.test(value)) score = 2;
  else if (/flash|instant/.test(value)) score = 3;
  else if (/sonnet/.test(value)) score = 7;
  else if (/opus|pro|max/.test(value)) score = 12;
  if (/thinking|reasoning/.test(value)) score += 0.8;
  return score;
}

function pickBudgetModel(models) {
  return [...models]
    .filter(isToyboxModelCandidate)
    .sort((a, b) => budgetScore(a) - budgetScore(b) || String(a).localeCompare(String(b)))[0] || '';
}

function taggedRounds(data, model) {
  const rounds = Array.isArray(data?.rounds) ? data.rounds : (data ? [data] : []);
  return rounds.filter(Boolean).map(item => ({ ...item, _toyboxModel: model || item.model || data?.model || '' }));
}

function takeQueuedRound(queue, model) {
  const list = Array.isArray(queue) ? queue : [];
  const index = list.findIndex(item => !model || !item?._toyboxModel || item._toyboxModel === model);
  if (index < 0) return { round: null, rest: list };
  return { round: list[index], rest: [...list.slice(0, index), ...list.slice(index + 1)] };
}

function BearIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="18" cy="18" r="8" />
      <circle cx="46" cy="18" r="8" />
      <path d="M13.5 34.5c0-13.8 7.6-22 18.5-22s18.5 8.2 18.5 22c0 12.5-7 20-18.5 20s-18.5-7.5-18.5-20Z" />
      <circle cx="25" cy="32" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="39" cy="32" r="1.8" fill="currentColor" stroke="none" />
      <ellipse cx="32" cy="40" rx="7.5" ry="6" />
      <path d="M29.4 39.2 32 41l2.6-1.8M32 41v2.2M28.6 43.3c2.2 1.7 4.6 1.7 6.8 0" />
    </svg>
  );
}

const GAME_CARDS = [
  { key: 'harmony', icon: '💌', title: '默契大考验', note: '一次锁一批答案，慢慢揭晓' },
  { key: 'drawing', icon: '🎨', title: '你画我猜', note: '画题批量缓存，猜画才调用一次' },
  { key: 'secret', icon: '🔐', title: '暗号猜猜', note: '随机题材，一次藏一批词' },
];

function HarmonyGame({ model, modelReady }) {
  const [round, setRound] = useState(null);
  const [choice, setChoice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(() => readJson(HARMONY_STORE, { played: 0, matches: 0, recent: [] }));
  const [queue, setQueue] = useState(() => readJson(HARMONY_QUEUE_STORE, []));

  const loadRound = useCallback(async () => {
    if (loading || !modelReady) return;
    setLoading(true);
    setError('');
    setChoice('');
    try {
      const cached = takeQueuedRound(queue, model);
      if (cached.round) {
        setRound(cached.round);
        setQueue(cached.rest);
        writeJson(HARMONY_QUEUE_STORE, cached.rest);
        return;
      }

      const data = await postToybox('/toybox/harmony-round', {
        recent_questions: stats.recent || [],
        count: 10,
        model,
      });
      const generated = taggedRounds(data, model);
      if (!generated.length) throw new Error('这批默契题没抽出来');
      const [first, ...rest] = generated;
      setRound(first);
      setQueue(rest);
      writeJson(HARMONY_QUEUE_STORE, rest);
      const questions = generated.map(item => item.question).filter(Boolean);
      const next = { ...stats, recent: [...questions, ...(stats.recent || [])].slice(0, 24) };
      setStats(next);
      writeJson(HARMONY_STORE, next);
    } catch (err) {
      setError(err.message || '题目没抽出来');
    } finally {
      setLoading(false);
    }
  }, [loading, modelReady, queue, model, stats]);

  useEffect(() => { if (!round && !loading && !error && modelReady) loadRound(); }, [round, loading, error, modelReady, loadRound]);

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
      {!modelReady && <div className="toy-loading">先等省钱模型准备好，别烧冤枉钱……</div>}
      {loading && modelReady && <div className="toy-loading">陆泽一次偷偷锁十道答案……</div>}
      {error && <div className="toy-error"><p>{error}</p><button type="button" onClick={loadRound}>再抽一批</button></div>}
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

function DrawingGame({ model, modelReady }) {
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
  const [queue, setQueue] = useState(() => readJson(DRAWING_QUEUE_STORE, []));

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
    if (loadingPrompt || !modelReady) return;
    setLoadingPrompt(true);
    setError('');
    setGuess(null);
    try {
      const cached = takeQueuedRound(queue, model);
      if (cached.round) {
        setPrompt(cached.round);
        setQueue(cached.rest);
        writeJson(DRAWING_QUEUE_STORE, cached.rest);
        resetCanvas();
        return;
      }
      const data = await postToybox('/toybox/drawing-prompt', { recent_prompts: recent, count: 12, model });
      const generated = taggedRounds(data, model);
      if (!generated.length) throw new Error('画题没抽出来');
      const [first, ...rest] = generated;
      setPrompt(first);
      setQueue(rest);
      writeJson(DRAWING_QUEUE_STORE, rest);
      const prompts = generated.map(item => item.prompt).filter(Boolean);
      const next = [...prompts, ...recent].slice(0, 24);
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
    if (guessing || !canvasRef.current || !modelReady) return;
    setGuessing(true);
    setError('');
    try {
      const data = await postToybox('/toybox/guess-drawing', {
        image: canvasRef.current.toDataURL('image/png'),
        model,
      });
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
        {prompt ? <><small>偷偷看题</small><b>{prompt.prompt}</b><p>{prompt.tease}</p></> : <><small>DRAW & GUESS</small><b>随便画，或者一次抽十二道题</b></>}
        <button type="button" onClick={newPrompt} disabled={loadingPrompt || !modelReady}>{loadingPrompt ? '抽一批中…' : prompt ? '换一道' : '给我出题'}</button>
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
        <button className="toy-primary" type="button" onClick={askGuess} disabled={guessing || !modelReady}>{guessing ? '陆泽在看……' : '让陆泽猜 · 调用1次'}</button>
      </div>
      <p className="toy-api-note">画画、擦除、换缓存题都不调用 API；只有点“让陆泽猜”才看图调用一次。</p>
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

function SecretGame({ model, modelReady }) {
  const [round, setRound] = useState(null);
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(() => readJson(SECRET_STORE, []));
  const [queue, setQueue] = useState(() => readJson(SECRET_QUEUE_STORE, []));

  const newRound = useCallback(async () => {
    if (loading || !modelReady) return;
    setLoading(true);
    setError('');
    setInput('');
    setGuesses([]);
    try {
      const cached = takeQueuedRound(queue, model);
      if (cached.round) {
        setRound(cached.round);
        setQueue(cached.rest);
        writeJson(SECRET_QUEUE_STORE, cached.rest);
        return;
      }
      const data = await postToybox('/toybox/secret-round', { recent_answers: recent, count: 12, model });
      const generated = taggedRounds(data, model);
      if (!generated.length) throw new Error('暗号没藏好');
      const [first, ...rest] = generated;
      setRound(first);
      setQueue(rest);
      writeJson(SECRET_QUEUE_STORE, rest);
      const answers = generated.map(item => item.answer).filter(Boolean);
      const next = [...answers, ...recent].slice(0, 28);
      setRecent(next);
      writeJson(SECRET_STORE, next);
    } catch (err) {
      setError(err.message || '暗号没藏好');
    } finally {
      setLoading(false);
    }
  }, [loading, modelReady, queue, model, recent]);

  useEffect(() => { if (!round && !loading && !error && modelReady) newRound(); }, [round, loading, error, modelReady, newRound]);

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
      {!modelReady && <div className="toy-loading">省钱模型还在找，先别让钱包受伤……</div>}
      {loading && modelReady && <div className="toy-loading">陆泽一次藏十二个随机暗号……</div>}
      {error && <div className="toy-error"><p>{error}</p><button type="button" onClick={newRound}>重新藏一批</button></div>}
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
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelError, setModelError] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => readString(MODEL_STORE));
  const [autoPicked, setAutoPicked] = useState(false);
  const game = useMemo(() => GAME_CARDS.find(item => item.key === activeGame), [activeGame]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    fetchToyboxModels()
      .then(list => {
        if (cancelled) return;
        const candidates = list.filter(isToyboxModelCandidate);
        setModels(candidates);
        const saved = readString(MODEL_STORE);
        if (saved && candidates.includes(saved)) {
          setSelectedModel(saved);
          setAutoPicked(false);
        } else {
          const picked = pickBudgetModel(candidates);
          setSelectedModel(picked);
          writeString(MODEL_STORE, picked);
          setAutoPicked(Boolean(picked));
        }
        setModelError('');
      })
      .catch(error => {
        if (cancelled) return;
        setModelError(error.message || '省钱模型没拿到');
      })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const chooseModel = value => {
    setSelectedModel(value);
    writeString(MODEL_STORE, value);
    setAutoPicked(false);
  };

  const autoChoose = () => {
    const picked = pickBudgetModel(models);
    if (!picked) return;
    setSelectedModel(picked);
    writeString(MODEL_STORE, picked);
    setAutoPicked(true);
  };

  const modelReady = Boolean(selectedModel) && !modelsLoading;

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

      <section className="toybox-budget-panel">
        <div className="toybox-budget-copy">
          <b>💰 省钱模型</b>
          <small>只给玩具箱用，不会改 Chat 的模型。</small>
        </div>
        <div className="toybox-budget-controls">
          <select value={selectedModel} disabled={modelsLoading || !models.length} onChange={event => chooseModel(event.target.value)} aria-label="选择玩具箱模型">
            {modelsLoading && <option value="">正在找便宜模型…</option>}
            {!modelsLoading && !models.length && <option value="">没有拿到模型列表</option>}
            {models.map(model => <option value={model} key={model}>{model}</option>)}
          </select>
          <button type="button" onClick={autoChoose} disabled={modelsLoading || !models.length}>自动省钱</button>
        </div>
        {selectedModel && <p>{autoPicked ? '已按站点价格标记 / 轻量模型名自动挑选：' : '当前玩具箱使用：'}<span>{selectedModel}</span></p>}
        {modelError && <p className="toybox-budget-error">{modelError}。为了防止误烧 Chat 大模型，AI 小游戏暂时不会自动调用。</p>}
      </section>

      {!activeGame && (
        <section className="toybox-shelf">
          <p>今天从哪一个开始捣乱？</p>
          <div className="toybox-game-grid toybox-game-grid--three">
            {GAME_CARDS.map(item => (
              <button key={item.key} type="button" className={`toybox-game-card toybox-game-card--${item.key}`} onClick={() => setActiveGame(item.key)}>
                <span>{item.icon}</span><strong>{item.title}</strong><small>{item.note}</small><i>打开 →</i>
              </button>
            ))}
          </div>
          <div className="toybox-footnote">默契题、暗号和画题会一次生成一批并缓存；连续玩不再一题烧一次 API。猫猫 2048 已撤掉。</div>
        </section>
      )}

      {activeGame === 'harmony' && <HarmonyGame model={selectedModel} modelReady={modelReady} />}
      {activeGame === 'drawing' && <DrawingGame model={selectedModel} modelReady={modelReady} />}
      {activeGame === 'secret' && <SecretGame model={selectedModel} modelReady={modelReady} />}
    </main>
  );
}
