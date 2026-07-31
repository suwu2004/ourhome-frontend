import { useEffect, useMemo, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';

const THEATER_DRAFT_KEY = 'ourhome_theater_draft_v1';

const emptyDraft = {
  theaterName: '未命名小剧场',
  premise: '',
  characters: '',
  rules: '',
  previousText: '',
  request: '',
  mode: 'main',
  lengthMode: 'long',
  save: true,
};

function readDraft() {
  try {
    const raw = localStorage.getItem(THEATER_DRAFT_KEY);
    return raw ? { ...emptyDraft, ...JSON.parse(raw) } : emptyDraft;
  } catch {
    return emptyDraft;
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hour}:${minute}`;
}

function Field({ label, hint, value, onChange, rows = 4, placeholder, theme }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
        <b style={{ color: theme.text, fontSize: 13, letterSpacing: '.06em' }}>{label}</b>
        {hint && <small style={{ color: theme.mutedLight, fontSize: 10 }}>{hint}</small>}
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          minHeight: rows * 26,
          resize: 'vertical',
          border: `1.5px solid ${theme.border}`,
          borderRadius: 12,
          background: theme.surface,
          color: theme.text,
          padding: '10px 11px',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 13,
          lineHeight: 1.65,
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}

export function TheaterRoom({ visible, theme, leaveRoom, selectedModel, availableModels = [] }) {
  const C = theme;
  const [draft, setDraft] = useState(readDraft);
  const [model, setModel] = useState(selectedModel || '');
  const [works, setWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const modelOptions = useMemo(
    () => [...new Set([model, selectedModel, ...availableModels].map(item => String(item || '').trim()).filter(Boolean))],
    [availableModels, model, selectedModel],
  );

  const updateDraft = patch => {
    setDraft(current => {
      const next = { ...current, ...patch };
      localStorage.setItem(THEATER_DRAFT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadWorks = async () => {
    setLoadingWorks(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/letters?category=${encodeURIComponent('小剧场')}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '小剧场书架没有打开');
      setWorks(Array.isArray(data) ? [...data].sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || '')) : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingWorks(false);
    }
  };

  useEffect(() => {
    if (visible) loadWorks();
  }, [visible]);

  useEffect(() => {
    if (selectedModel) setModel(selectedModel);
  }, [selectedModel]);

  const generate = async () => {
    if (!draft.premise.trim() && !draft.characters.trim() && !draft.request.trim()) {
      setError('先给小剧场一点设定、角色，或者这次想看的剧情。');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theater_name: draft.theaterName,
          premise: draft.premise,
          characters: draft.characters,
          rules: draft.rules,
          previous_text: draft.previousText,
          request: draft.request,
          mode: draft.mode,
          length_mode: draft.lengthMode,
          save: draft.save,
          model,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '小剧场这次没有写成');
      setResult(data);
      updateDraft({
        previousText: [draft.previousText, data.content].filter(Boolean).join('\n\n'),
        request: '',
      });
      if (data.saved) await loadWorks();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const continueFrom = work => {
    updateDraft({
      theaterName: draft.theaterName === emptyDraft.theaterName && work.title ? work.title : draft.theaterName,
      previousText: work.content || '',
      request: '',
      mode: 'main',
    });
    setResult({ title: work.title, content: work.content, saved: work });
  };

  const deleteWork = async id => {
    if (!window.confirm('删除这篇小剧场作品吗？')) return;
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/letters/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '删除失败');
      setWorks(items => items.filter(item => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity .4s ease', background: C.cream }}>
      <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: 'pointer', padding: 4 }}>←</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: '.05em' }}>小剧场</div>
          <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: '.14em' }}>theater room</div>
        </div>
        <button type="button" onClick={loadWorks} disabled={loadingWorks} style={{ border: `1px solid ${C.border}`, background: C.surface, color: C.honeyDeep, borderRadius: 999, padding: '6px 10px', fontFamily: 'inherit', fontSize: 11, cursor: loadingWorks ? 'default' : 'pointer' }}>{loadingWorks ? '翻找中' : '刷新'}</button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '16px min(18px, 4vw) 24px' }}>
        <section style={{ maxWidth: 980, margin: '0 auto', display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 14, boxShadow: `0 10px 26px ${C.borderLight}66` }}>
              <label style={{ display: 'block', marginBottom: 12 }}>
                <span style={{ display: 'block', marginBottom: 6, color: C.text, fontSize: 13, fontWeight: 700 }}>剧场名</span>
                <input
                  value={draft.theaterName}
                  onChange={event => updateDraft({ theaterName: event.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 999, background: C.surface, color: C.text, padding: '9px 12px', outline: 'none', fontFamily: 'inherit' }}
                />
              </label>
              <Field theme={C} label="世界观 / 剧情设定" hint="不会混入主线记忆" rows={5} value={draft.premise} onChange={value => updateDraft({ premise: value })} placeholder="比如：架空都市、契约关系、重逢、校园、古风……" />
              <div style={{ height: 12 }} />
              <Field theme={C} label="角色卡 / 关系" hint="防 OOC 的核心" rows={5} value={draft.characters} onChange={value => updateDraft({ characters: value })} placeholder="写人物性格、关系张力、称呼、说话方式、不能崩的点……" />
              <div style={{ height: 12 }} />
              <Field theme={C} label="禁区 / 写作规则" rows={3} value={draft.rules} onChange={value => updateDraft({ rules: value })} placeholder="比如：不要突然和解；不要现代词；不要分条；不要跳出剧情解释……" />
            </div>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  ['main', '正文续写'],
                  ['extra', '番外'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => updateDraft({ mode: value })} style={{ border: `1px solid ${draft.mode === value ? C.honeyMid : C.border}`, background: draft.mode === value ? C.honeyLight : C.surface, color: draft.mode === value ? C.honeyDeep : C.muted, borderRadius: 999, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
                ))}
                {[
                  ['short', '短一点'],
                  ['long', '长文'],
                  ['extra_long', '超长'],
                ].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => updateDraft({ lengthMode: value })} style={{ border: `1px solid ${draft.lengthMode === value ? C.blush : C.border}`, background: draft.lengthMode === value ? '#FFF0E9' : C.surface, color: draft.lengthMode === value ? C.blushDeep : C.muted, borderRadius: 999, padding: '7px 12px', fontFamily: 'inherit', cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
              <Field theme={C} label="此前正文 / 剧情进度" hint="可粘贴上一段，也可从书架载入" rows={6} value={draft.previousText} onChange={value => updateDraft({ previousText: value })} placeholder="如果是开篇可以空着；如果要接文，把上一段或剧情摘要放这里。" />
              <div style={{ height: 12 }} />
              <Field theme={C} label="这次想看的内容" rows={4} value={draft.request} onChange={value => updateDraft({ request: value })} placeholder={draft.mode === 'extra' ? '比如：写一个下雨天的番外 / 婚后小片段 / IF线……' : '比如：接着写冲突升级 / 写见面 / 写告白前的拉扯……'} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <select value={model} onChange={event => setModel(event.target.value)} style={{ flex: '1 1 220px', minWidth: 0, border: `1px solid ${C.border}`, background: C.surface, color: C.muted, borderRadius: 999, padding: '7px 10px', fontFamily: 'inherit', fontSize: 11 }}>
                  {modelOptions.length ? modelOptions.map(item => <option key={item} value={item}>{item}</option>) : <option value="">默认模型</option>}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.muted, fontSize: 12 }}>
                  <input type="checkbox" checked={draft.save} onChange={event => updateDraft({ save: event.target.checked })} />
                  保存到剧场书架
                </label>
                <button type="button" onClick={generate} disabled={generating} style={{ border: 'none', borderRadius: 999, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, padding: '10px 18px', fontFamily: 'inherit', cursor: generating ? 'default' : 'pointer', opacity: generating ? .65 : 1 }}>{generating ? '写作中…' : draft.mode === 'extra' ? '写番外' : '开始续写'}</button>
              </div>
              {error && <div style={{ marginTop: 10, color: C.blushDeep, fontSize: 12, lineHeight: 1.6 }}>{error}</div>}
            </div>

            {result && (
              <article style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: 'linear-gradient(180deg, #fffdfa, #fff7ec)', padding: '18px 16px', color: C.text, boxShadow: `0 12px 28px ${C.borderLight}88` }}>
                <h2 style={{ margin: '0 0 12px', fontSize: 18, color: C.text }}>{result.title || '小剧场'}</h2>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, fontSize: 15 }}>{result.content}</div>
              </article>
            )}
          </div>

          <aside style={{ flex: '1 1 280px', minWidth: 0 }}>
            <div style={{ position: 'sticky', top: 12, border: `1px solid ${C.border}`, borderRadius: 14, background: C.white, padding: 14 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 700, letterSpacing: '.08em' }}>剧场书架</div>
                <div style={{ color: C.mutedLight, fontSize: 10, marginTop: 2 }}>保存过的正文和番外</div>
              </div>
              {loadingWorks && <div style={{ color: C.muted, fontSize: 12, padding: '12px 0' }}>正在翻找小剧场…</div>}
              {!loadingWorks && works.length === 0 && <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.7, padding: '12px 0' }}>还没有保存的作品。先写第一篇吧。</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {works.map(work => (
                  <div key={work.id} style={{ border: `1px solid ${C.borderLight}`, borderRadius: 12, background: C.surface, padding: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <b style={{ color: C.text, fontSize: 13, lineHeight: 1.4 }}>{work.title || '无标题'}</b>
                      <span style={{ color: C.mutedLight, fontSize: 9, flexShrink: 0 }}>{formatDate(work.created_at)}</span>
                    </div>
                    <p style={{ margin: '7px 0 9px', color: C.muted, fontSize: 11.5, lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{work.content}</p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => continueFrom(work)} style={{ border: 'none', background: 'transparent', color: C.honeyDeep, fontFamily: 'inherit', cursor: 'pointer', fontSize: 11 }}>接着写</button>
                      <button type="button" onClick={() => deleteWork(work.id)} style={{ border: 'none', background: 'transparent', color: C.muted, fontFamily: 'inherit', cursor: 'pointer', fontSize: 11 }}>删除</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
