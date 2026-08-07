import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useTheme } from './ThemeContext.jsx';
import './ToyBoxRoom.css';
import './ToyBoxSocial.css';

const SESSION_KEY = 'ourhome_session_id';
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
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function readString(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

function writeString(key, value) {
  try { localStorage.setItem(key, value || ''); } catch { /* ignore */ }
}

async function requestJson(path, options = {}) {
  const response = await apiFetch(`${BACKEND}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || '这个小玩具暂时卡住了');
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
      <circle cx="19" cy="18" r="8" />
      <circle cx="45" cy="18" r="8" />
      <path d="M14 35c0-13 7.5-21 18-21s18 8 18 21c0 12-6.8 19-18 19s-18-7-18-19Z" />
      <circle cx="25" cy="32" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="39" cy="32" r="1.7" fill="currentColor" stroke="none" />
      <ellipse cx="32" cy="40" rx="7" ry="5.5" />
      <path d="M29.5 39.2 32 41l2.5-1.8M32 41v2M28.8 43.2c2 1.5 4.4 1.5 6.4 0" />
    </svg>
  );
}

const GAME_META = {
  harmony: { icon: '💌', title: '默契大考验', note: '答案先锁住，再一起揭晓' },
  drawing: { icon: '🎨', title: '你画我猜', note: '你画，陆泽真的看图来猜' },
  secret: { icon: '🔐', title: '暗号猜猜', note: '随机题材，不被固定词库绑住' },
};

function runSummary(run) {
  if (!run) return '';
  const state = run.state || {};
  const result = run.result || {};
  if (run.status === 'invited') return '等你接招';
  if (run.status === 'active') return '正在玩';
  if (run.status === 'abandoned') return '这局中途收起来了';
  if (run.game === 'harmony') return result.matched ? '♡ 这题想到一起了' : '↯ 这题答案不同';
  if (run.game === 'secret') return result.won ? `猜中了「${result.answer || state.answer || ''}」` : `答案是「${result.answer || state.answer || ''}」`;
  if (run.game === 'drawing') return result.guess ? `陆泽猜：${result.guess}` : '画完啦';
  return '玩完一局';
}

function formatRunTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function useToyboxLedger() {
  const [history, setHistory] = useState([]);
  const [openRuns, setOpenRuns] = useState([]);
  const [historyError, setHistoryError] = useState('');

  const refreshHistory = useCallback(async () => {
    try {
      const data = await requestJson('/toybox/history?limit=50');
      setHistory(Array.isArray(data?.runs) ? data.runs : []);
      setHistoryError('');
    } catch (error) {
      setHistoryError(error.message || '记录册暂时打不开');
    }
  }, []);

  const refreshOpen = useCallback(async () => {
    try {
      const data = await requestJson('/toybox/open');
      setOpenRuns(Array.isArray(data?.runs) ? data.runs : []);
    } catch {
      setOpenRuns([]);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
    refreshOpen();
    const timer = window.setInterval(refreshOpen, 4000);
    return () => window.clearInterval(timer);
  }, [refreshHistory, refreshOpen]);

  const startRun = useCallback(async (game, state, model, extra = {}) => {
    try {
      const run = await postJson('/toybox/runs', {
        game,
        status: extra.status || 'active',
        initiator: extra.initiator || 'user',
        chat_session_id: readString(SESSION_KEY) || null,
        state,
        model: model || null,
        title: extra.title || '',
      });
      refreshHistory();
      refreshOpen();
      return run;
    } catch (error) {
      console.warn('Toybox record start failed:', error.message);
      return null;
    }
  }, [refreshHistory, refreshOpen]);

  const appendEvent = useCallback(async (runId, actor, eventType, payload = {}) => {
    if (!runId) return null;
    try {
      const event = await postJson(`/toybox/runs/${runId}/events`, { actor, event_type: eventType, payload });
      refreshHistory();
      return event;
    } catch (error) {
      console.warn('Toybox event failed:', error.message);
      return null;
    }
  }, [refreshHistory]);

  const updateRun = useCallback(async (runId, patch) => {
    if (!runId) return null;
    try {
      const run = await patchJson(`/toybox/runs/${runId}`, patch);
      refreshHistory();
      refreshOpen();
      return run;
    } catch (error) {
      console.warn('Toybox record update failed:', error.message);
      return null;
    }
  }, [refreshHistory, refreshOpen]);

  return { history, openRuns, historyError, refreshHistory, refreshOpen, startRun, appendEvent, updateRun };
}

function HarmonyGame({ model, modelReady, ledger, initialRun, consumeInitialRun }) {
  const [round, setRound] = useState(null);
  const [runId, setRunId] = useState(null);
  const [choice, setChoice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(() => readJson(HARMONY_STORE, { played: 0, matches: 0, recent: [] }));
  const [queue, setQueue] = useState(() => readJson(HARMONY_QUEUE_STORE, []));

  useEffect(() => {
    if (!initialRun || round) return;
    setRound(initialRun.state || {});
    setRunId(initialRun.id);
    setChoice('');
    consumeInitialRun?.();
  }, [initialRun, round, consumeInitialRun]);

  const installRound = useCallback(async (nextRound) => {
    setRound(nextRound);
    setChoice('');
    const run = await ledger.startRun('harmony', nextRound, model);
    setRunId(run?.id || null);
  }, [ledger, model]);

  const loadRound = useCallback(async () => {
    if (loading || !modelReady) return;
    if (runId && !choice) ledger.updateRun(runId, { status: 'abandoned' });
    setLoading(true);
    setError('');
    setChoice('');
    try {
      const cached = takeQueuedRound(queue, model);
      if (cached.round) {
        setQueue(cached.rest);
        writeJson(HARMONY_QUEUE_STORE, cached.rest);
        await installRound(cached.round);
        return;
      }
      const data = await postJson('/toybox/harmony-round', { recent_questions: stats.recent || [], count: 10, model });
      const generated = taggedRounds(data, model);
      if (!generated.length) throw new Error('这批默契题没抽出来');
      const [first, ...rest] = generated;
      setQueue(rest);
      writeJson(HARMONY_QUEUE_STORE, rest);
      const questions = generated.map(item => item.question).filter(Boolean);
      const nextStats = { ...stats, recent: [...questions, ...(stats.recent || [])].slice(0, 24) };
      setStats(nextStats);
      writeJson(HARMONY_STORE, nextStats);
      await installRound(first);
    } catch (err) {
      setError(err.message || '题目没抽出来');
    } finally {
      setLoading(false);
    }
  }, [choice, installRound, ledger, loading, model, modelReady, queue, runId, stats]);

  useEffect(() => {
    if (!initialRun && !round && !loading && !error && modelReady) loadRound();
  }, [initialRun, round, loading, error, modelReady, loadRound]);

  const choose = value => {
    if (!round || choice) return;
    setChoice(value);
    const matched = value === round.luze_choice;
    const next = { ...stats, played: (stats.played || 0) + 1, matches: (stats.matches || 0) + (matched ? 1 : 0) };
    setStats(next);
    writeJson(HARMONY_STORE, next);
    ledger.appendEvent(runId, 'user', 'choice', { choice: value, matched });
    ledger.updateRun(runId, {
      status: 'completed',
      result: { user_choice: value, luze_choice: round.luze_choice, matched, luze_comment: round.luze_comment || '' },
    });
  };

  const rate = stats.played ? Math.round((stats.matches / stats.played) * 100) : 0;

  return (
    <section className="toy-game toy-harmony">
      <div className="toy-score-strip"><span>玩过 {stats.played || 0} 题</span><b>默契 {rate}%</b></div>
      {!modelReady && <div className="toy-loading">先等省钱模型准备好……</div>}
      {loading && modelReady && <div className="toy-loading">陆泽一次偷偷锁十道答案……</div>}
      {error && <div className="toy-error"><p>{error}</p><button type="button" onClick={loadRound}>再抽一批</button></div>}
      {round && !loading && (
        <>
          <article className="toy-question-card">
            <small>{initialRun ? 'LUZE INVITED YOU' : 'THIS OR THAT'}</small>
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

function guessFeedback(answer, guess) {
  const answerChars = [...answer];
  return [...guess].map((char, index) => ({
    char,
    status: answerChars[index] === char ? 'exact' : answerChars.includes(char) ? 'present' : 'miss',
  }));
}

function SecretGame({ model, modelReady, ledger, initialRun, consumeInitialRun }) {
  const [round, setRound] = useState(null);
  const [runId, setRunId] = useState(null);
  const [input, setInput] = useState('');
  const [guesses, setGuesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(() => readJson(SECRET_STORE, []));
  const [queue, setQueue] = useState(() => readJson(SECRET_QUEUE_STORE, []));

  useEffect(() => {
    if (!initialRun || round) return;
    setRound(initialRun.state || {});
    setRunId(initialRun.id);
    setGuesses([]);
    consumeInitialRun?.();
  }, [initialRun, round, consumeInitialRun]);

  const installRound = useCallback(async (nextRound) => {
    setRound(nextRound);
    setGuesses([]);
    setInput('');
    const run = await ledger.startRun('secret', nextRound, model);
    setRunId(run?.id || null);
  }, [ledger, model]);

  const newRound = useCallback(async () => {
    if (loading || !modelReady) return;
    if (runId && round && !guesses.some(item => item.value === round.answer) && guesses.length < 6) {
      ledger.updateRun(runId, { status: 'abandoned' });
    }
    setLoading(true);
    setError('');
    try {
      const cached = takeQueuedRound(queue, model);
      if (cached.round) {
        setQueue(cached.rest);
        writeJson(SECRET_QUEUE_STORE, cached.rest);
        await installRound(cached.round);
        return;
      }
      const data = await postJson('/toybox/secret-round', { recent_answers: recent, count: 12, model });
      const generated = taggedRounds(data, model);
      if (!generated.length) throw new Error('暗号没藏好');
      const [first, ...rest] = generated;
      setQueue(rest);
      writeJson(SECRET_QUEUE_STORE, rest);
      const answers = generated.map(item => item.answer).filter(Boolean);
      const next = [...answers, ...recent].slice(0, 28);
      setRecent(next);
      writeJson(SECRET_STORE, next);
      await installRound(first);
    } catch (err) {
      setError(err.message || '暗号没藏好');
    } finally {
      setLoading(false);
    }
  }, [guesses, installRound, ledger, loading, model, modelReady, queue, recent, round, runId]);

  useEffect(() => {
    if (!initialRun && !round && !loading && !error && modelReady) newRound();
  }, [initialRun, round, loading, error, modelReady, newRound]);

  const won = Boolean(round && guesses.some(item => item.value === round.answer));
  const finished = won || guesses.length >= 6;

  const submit = event => {
    event.preventDefault();
    if (!round || finished) return;
    const value = input.replace(/\s+/g, '').trim();
    if (!value || guesses.some(item => item.value === value)) { setInput(''); return; }
    const nextGuesses = [...guesses, { value, feedback: guessFeedback(round.answer, value) }];
    setGuesses(nextGuesses);
    setInput('');
    const hit = value === round.answer;
    ledger.appendEvent(runId, 'user', 'guess', { guess: value, hit, number: nextGuesses.length });
    if (hit || nextGuesses.length >= 6) {
      ledger.updateRun(runId, {
        status: 'completed',
        result: { won: hit, answer: round.answer, guesses: nextGuesses.map(item => item.value), attempts: nextGuesses.length },
      });
    }
  };

  return (
    <section className="toy-game toy-secret">
      {loading && <div className="toy-loading">陆泽正在一次藏一打词……</div>}
      {error && <div className="toy-error"><p>{error}</p><button type="button" onClick={newRound}>重新藏</button></div>}
      {round && !loading && (
        <>
          <article className="secret-clue">
            <small>分类 · {round.category || '随机'}</small>
            <h2>{'□'.repeat(Math.min([...(round.answer || '')].length, 8))}</h2>
            <p>提示一：{round.hint1 || '先猜一猜。'}</p>
            {guesses.length >= 3 && !finished && <p>提示二：{round.hint2 || '再往近一点想。'}</p>}
          </article>
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
          {finished && (
            <article className={`secret-result ${won ? 'is-win' : ''}`}>
              <span>{won ? '✦ 猜中了' : '答案揭晓'}</span><h3>{round.answer}</h3><p>{round.reveal_comment}</p>
              <button type="button" onClick={newRound}>再藏一个</button>
            </article>
          )}
        </>
      )}
    </section>
  );
}

function DrawingGame({ model, modelReady, ledger, initialRun, consumeInitialRun }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [prompt, setPrompt] = useState(null);
  const [runId, setRunId] = useState(null);
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

  useEffect(() => {
    if (!initialRun || prompt) return;
    setPrompt(initialRun.state || {});
    setRunId(initialRun.id);
    resetCanvas();
    consumeInitialRun?.();
  }, [initialRun, prompt, consumeInitialRun, resetCanvas]);

  const installPrompt = useCallback(async (nextPrompt) => {
    setPrompt(nextPrompt);
    setGuess(null);
    resetCanvas();
    const run = await ledger.startRun('drawing', nextPrompt, model);
    setRunId(run?.id || null);
  }, [ledger, model, resetCanvas]);

  const pointFor = event => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
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
    if (runId && !guess) ledger.updateRun(runId, { status: 'abandoned' });
    setLoadingPrompt(true);
    setError('');
    try {
      const cached = takeQueuedRound(queue, model);
      if (cached.round) {
        setQueue(cached.rest);
        writeJson(DRAWING_QUEUE_STORE, cached.rest);
        await installPrompt(cached.round);
        return;
      }
      const data = await postJson('/toybox/drawing-prompt', { recent_prompts: recent, count: 12, model });
      const generated = taggedRounds(data, model);
      if (!generated.length) throw new Error('画题没抽出来');
      const [first, ...rest] = generated;
      setQueue(rest);
      writeJson(DRAWING_QUEUE_STORE, rest);
      const prompts = generated.map(item => item.prompt).filter(Boolean);
      const next = [...prompts, ...recent].slice(0, 24);
      setRecent(next);
      writeJson(DRAWING_STORE, next);
      await installPrompt(first);
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
      const data = await postJson('/toybox/guess-drawing', { image: canvasRef.current.toDataURL('image/png'), model });
      setGuess(data);
      ledger.appendEvent(runId, 'luze', 'guess_drawing', { guess: data.guess, comment: data.comment, confidence: data.confidence });
      ledger.updateRun(runId, { status: 'completed', result: { guess: data.guess, comment: data.comment, confidence: data.confidence } });
    } catch (err) {
      setError(err.message || '陆泽这次没看懂');
    } finally {
      setGuessing(false);
    }
  };

  return (
    <section className="toy-game toy-drawing">
      <div className="drawing-prompt">
        {prompt ? <><small>{initialRun ? '陆泽出的题' : '偷偷看题'}</small><b>{prompt.prompt}</b><p>{prompt.tease}</p></> : <><small>DRAW & GUESS</small><b>随便画，或者一次抽十二道题</b></>}
        <button type="button" onClick={newPrompt} disabled={loadingPrompt || !modelReady}>{loadingPrompt ? '抽一批中…' : prompt ? '换一道' : '给我出题'}</button>
      </div>
      <canvas ref={canvasRef} className="toy-canvas" width="640" height="460" onPointerDown={startDraw} onPointerMove={draw} onPointerUp={stopDraw} onPointerCancel={stopDraw} onPointerLeave={stopDraw} />
      <div className="drawing-tools">
        <button type="button" className={eraser ? 'is-active' : ''} onClick={() => setEraser(value => !value)}>{eraser ? '✎ 画笔' : '⌫ 橡皮'}</button>
        <button type="button" onClick={resetCanvas}>清空</button>
        <button className="toy-primary" type="button" onClick={askGuess} disabled={guessing || !modelReady}>{guessing ? '陆泽在看……' : '让陆泽猜 · 1次看图'}</button>
      </div>
      {error && <p className="toy-inline-error">{error}</p>}
      {guess && <article className="drawing-guess"><small>陆泽猜</small><h3>{guess.guess}</h3><p>{guess.comment}</p><span>把握：{guess.confidence === 'high' ? '很大' : guess.confidence === 'low' ? '不太大' : '一半一半'}</span></article>}
    </section>
  );
}

function ToyboxHistoryDrawer({ open, onClose, history, error }) {
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const openDetail = async run => {
    setSelected(run);
    setDetail(null);
    setLoading(true);
    try { setDetail(await requestJson(`/toybox/runs/${run.id}`)); }
    catch { setDetail(run); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!open) { setSelected(null); setDetail(null); } }, [open]);
  if (!open) return null;

  return (
    <div className="toy-social-layer" role="dialog" aria-label="游戏记录册">
      <div className="toy-history-sheet">
        <header><div><small>OUR PLAY LOG</small><h2>{selected ? '这一局' : '游戏记录册'}</h2></div><button type="button" onClick={() => selected ? setSelected(null) : onClose()}>×</button></header>
        {selected ? (
          <div className="toy-history-detail">
            <button type="button" className="toy-history-back" onClick={() => setSelected(null)}>← 返回记录</button>
            <div className="toy-history-hero"><span>{GAME_META[selected.game]?.icon}</span><div><b>{selected.title || GAME_META[selected.game]?.title}</b><small>{selected.initiator === 'luze' ? '陆泽发起' : '你发起'} · {formatRunTime(selected.created_at)}</small></div></div>
            <p className="toy-history-result">{runSummary(selected)}</p>
            {loading && <p className="toy-history-muted">正在翻这一页……</p>}
            {(detail?.events || []).map(event => (
              <div className="toy-event-line" key={event.id}><span>{event.actor === 'luze' ? '泽' : event.actor === 'user' ? '檀' : '·'}</span><div><b>{event.event_type}</b><p>{event.payload?.note || event.payload?.guess || event.payload?.choice || event.payload?.title || ''}</p></div></div>
            ))}
          </div>
        ) : (
          <div className="toy-history-list">
            {error && <p className="toy-inline-error">{error}</p>}
            {!history.length && !error && <p className="toy-history-empty">第一局还没写进来。等我们玩完，它就会留在这里。</p>}
            {history.map(run => (
              <button type="button" className="toy-history-card" key={run.id} onClick={() => openDetail(run)}>
                <span>{GAME_META[run.game]?.icon || '🧸'}</span><div><b>{run.title || GAME_META[run.game]?.title}</b><small>{run.initiator === 'luze' ? '陆泽发起' : '你发起'} · {formatRunTime(run.created_at)}</small><p>{runSummary(run)}</p></div><i>›</i>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToyboxChatDock({ open, onClose, onGameActivity }) {
  const { theme: C } = useTheme();
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const loadMessages = useCallback(async id => {
    if (!id) return;
    try {
      const rows = await requestJson(`/sessions/${id}/messages`);
      setMessages(Array.isArray(rows) ? rows.slice(-40) : []);
    } catch (err) {
      setError(err.message || '聊天暂时没打开');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [sessions, settings] = await Promise.all([requestJson('/sessions'), requestJson('/settings')]);
        if (cancelled) return;
        const list = Array.isArray(sessions) ? sessions : [];
        const stored = readString(SESSION_KEY);
        let target = list.find(item => String(item.id) === stored) || list.find(item => item.name === '日常') || list[0];
        if (!target) target = await postJson('/sessions', { name: '日常' });
        if (cancelled) return;
        setSessionId(String(target.id));
        writeString(SESSION_KEY, String(target.id));
        setModel(settings?.selected_model || '');
        await loadMessages(target.id);
      } catch (err) {
        if (!cancelled) setError(err.message || '聊天暂时没打开');
      }
    })();
    return () => { cancelled = true; };
  }, [open, loadMessages]);

  useEffect(() => {
    if (!open || !sessionId) return undefined;
    const timer = window.setInterval(() => loadMessages(sessionId), 7000);
    return () => window.clearInterval(timer);
  }, [open, sessionId, loadMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async event => {
    event?.preventDefault?.();
    const text = input.trim();
    if (!text || !sessionId || sending) return;
    setInput('');
    setSending(true);
    setError('');
    const temp = { id: `temp-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() };
    setMessages(items => [...items, temp]);
    try {
      const data = await postJson('/chat', { session_id: sessionId, message: text, model: model || undefined });
      await loadMessages(sessionId);
      onGameActivity?.();
      if (!data?.reply) setError('陆泽这次没有回出正文。');
    } catch (err) {
      setError(err.message || '这句话没发出去');
      await loadMessages(sessionId);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;
  return (
    <aside className="toy-chat-dock" style={{ '--dock-cream': C.cream, '--dock-white': C.white, '--dock-text': C.text, '--dock-muted': C.muted, '--dock-border': C.border, '--dock-honey': C.honeyLight }}>
      <header><div><small>MAIN CHAT · SAME SESSION</small><b>边玩边和陆泽说话</b></div><button type="button" onClick={onClose}>×</button></header>
      <div className="toy-chat-messages" ref={listRef}>
        {messages.map(message => {
          const mine = message.role === 'user';
          return <div className={`toy-chat-line ${mine ? 'is-mine' : 'is-luze'}`} key={message.id}><span>{mine ? '檀' : '泽'}</span><p>{message.content}</p></div>;
        })}
        {sending && <div className="toy-chat-line is-luze"><span>泽</span><p>想了想……</p></div>}
      </div>
      {error && <div className="toy-chat-error">{error}</div>}
      <form onSubmit={send} className="toy-chat-form"><textarea value={input} onChange={event => setInput(event.target.value)} placeholder="一边玩，一边跟他说……" rows={1} /><button type="submit" disabled={sending || !input.trim()}>↑</button></form>
    </aside>
  );
}

export default function ToyBoxSharedRoom({ onClose }) {
  const { darkMode } = useTheme();
  const ledger = useToyboxLedger();
  const [activeGame, setActiveGame] = useState(null);
  const [acceptedRun, setAcceptedRun] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState(() => readString(MODEL_STORE));
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setModelsLoading(true);
      try {
        const data = await requestJson('/settings/models');
        const list = (Array.isArray(data?.models) ? data.models : []).map(String).filter(isToyboxModelCandidate);
        if (cancelled) return;
        setModels(list);
        const saved = readString(MODEL_STORE);
        const chosen = saved && list.includes(saved) ? saved : pickBudgetModel(list);
        setModel(chosen);
        writeString(MODEL_STORE, chosen);
        setModelsError(chosen ? '' : '当前站点没有找到适合小游戏的模型');
      } catch (error) {
        if (!cancelled) setModelsError(error.message || '省钱模型没拿到');
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const game = activeGame ? GAME_META[activeGame] : null;
  const invitation = ledger.openRuns.find(run => run.initiator === 'luze' && run.status === 'invited') || null;

  const acceptInvitation = async run => {
    const accepted = await ledger.updateRun(run.id, { status: 'active' });
    setAcceptedRun(accepted || { ...run, status: 'active' });
    setActiveGame(run.game);
  };

  const consumeInitialRun = useCallback(() => setAcceptedRun(null), []);
  const modelReady = Boolean(model) && !modelsLoading;

  return (
    <main className={`toybox-room toybox-shared-room ${darkMode ? 'toybox-room--night' : ''}`}>
      <div className="toybox-glow" aria-hidden="true"><i /><i /><i /></div>
      <header className="toybox-header toybox-shared-header">
        <button className="toybox-back" type="button" onClick={() => activeGame ? setActiveGame(null) : onClose()} aria-label={activeGame ? '返回玩具箱' : '返回主页'}>←</button>
        <div className="toybox-title"><span className="toybox-bear"><BearIcon /></span><div><small>OUR LITTLE TOYBOX</small><h1>{game?.title || '玩具箱'}</h1></div></div>
        <button className="toybox-log-button" type="button" onClick={() => { ledger.refreshHistory(); setHistoryOpen(true); }} aria-label="游戏记录">⌇</button>
      </header>

      <section className="toy-budget-panel">
        <div><small>💰 省钱模型 · 只管小游戏</small><b>{modelsLoading ? '正在挑最省的一只……' : model || '还没选到'}</b></div>
        <select value={model} disabled={modelsLoading} onChange={event => { setModel(event.target.value); writeString(MODEL_STORE, event.target.value); }}>
          {models.map(item => <option value={item} key={item}>{item}</option>)}
        </select>
        <p>默契 10 题 / 暗号 12 局 / 画题 12 道共用一次调用；只有点「让陆泽猜」才额外看图一次。</p>
        {modelsError && <em>{modelsError}</em>}
      </section>

      {invitation && (!acceptedRun || acceptedRun.id !== invitation.id) && (
        <section className="toy-invite-banner">
          <span>{GAME_META[invitation.game]?.icon || '🧸'}</span><div><small>陆泽偷偷开了一局</small><b>{invitation.title || GAME_META[invitation.game]?.title}</b></div><button type="button" onClick={() => acceptInvitation(invitation)}>接招 👿</button>
        </section>
      )}

      {!activeGame && (
        <section className="toybox-shelf">
          <p>今天从哪一个开始捣乱？陆泽也能从 Chat 里主动开局。</p>
          <div className="toybox-game-grid toybox-game-grid--three">
            {Object.entries(GAME_META).map(([key, item]) => (
              <button key={key} type="button" className={`toybox-game-card toybox-game-card--${key}`} onClick={() => setActiveGame(key)}><span>{item.icon}</span><strong>{item.title}</strong><small>{item.note}</small><i>打开 →</i></button>
            ))}
          </div>
          <div className="toybox-footnote">每一局都会写进我们的记录册；游戏不会把假消息塞进 Chat，但 Chat 能真实读取游戏状态。</div>
        </section>
      )}

      {activeGame === 'harmony' && <HarmonyGame model={model} modelReady={modelReady} ledger={ledger} initialRun={acceptedRun?.game === 'harmony' ? acceptedRun : null} consumeInitialRun={consumeInitialRun} />}
      {activeGame === 'drawing' && <DrawingGame model={model} modelReady={modelReady} ledger={ledger} initialRun={acceptedRun?.game === 'drawing' ? acceptedRun : null} consumeInitialRun={consumeInitialRun} />}
      {activeGame === 'secret' && <SecretGame model={model} modelReady={modelReady} ledger={ledger} initialRun={acceptedRun?.game === 'secret' ? acceptedRun : null} consumeInitialRun={consumeInitialRun} />}

      <div className="toybox-floating-actions">
        <button type="button" onClick={() => { ledger.refreshHistory(); setHistoryOpen(true); }}>📖<span>记录</span></button>
        <button type="button" className="is-chat" onClick={() => setChatOpen(value => !value)}>💬<span>陆泽</span></button>
      </div>

      <ToyboxHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} history={ledger.history} error={ledger.historyError} />
      <ToyboxChatDock open={chatOpen} onClose={() => setChatOpen(false)} onGameActivity={ledger.refreshOpen} />
    </main>
  );
}
