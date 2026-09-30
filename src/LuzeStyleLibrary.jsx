import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useDialogLayer } from './useDialogLayer.js';
import './TheaterRuleLibrary.css';

const STYLE_SOURCE = 'luze_style';
const scopeOptions = [
  { value: 'chat', label: '仅 Chat' },
  { value: 'theater', label: '仅小剧场' },
  { value: 'both', label: '两边都用' },
];

const emptyDraft = { id: null, title: '', content: '', enabled: true, apply_scope: 'chat' };

const normalizeScope = value => scopeOptions.some(item => item.value === value) ? value : 'chat';
const scopeLabel = value => scopeOptions.find(item => item.value === normalizeScope(value))?.label || '仅 Chat';
const filenameTitle = name => String(name || '').replace(/\.(?:docx|txt|md)$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '导入的文风';
const readJson = response => response.json().catch(() => ({}));

export default function LuzeStyleLibrary() {
  const [open, setOpen] = useState(false);
  const [styles, setStyles] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mobilePane, setMobilePane] = useState('list');
  const fileInputRef = useRef(null);
  const closeButtonRef = useRef(null);

  const enabledCount = useMemo(() => styles.filter(item => item.enabled).length, [styles]);
  const loadStyles = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules`);
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '文风库没有打开');
      setStyles((Array.isArray(data) ? data : []).filter(item => item.source_name === STYLE_SOURCE));
    } catch (err) {
      setError(err.message || '文风库没有打开');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) loadStyles(); }, [open, loadStyles]);
  const closeLibrary = useCallback(() => setOpen(false), []);
  useDialogLayer(open, closeLibrary, closeButtonRef);

  const saveDraft = async () => {
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!title) return setError('先给这份文风取一个名字。');
    if (!content) return setError('文风正文还没有写。');
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules${draft.id ? `/${draft.id}` : ''}`, {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, enabled: draft.enabled, apply_scope: normalizeScope(draft.apply_scope), source_name: STYLE_SOURCE }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '文风没有保存成功');
      await loadStyles(); setDraft(emptyDraft); setMobilePane('list');
    } catch (err) { setError(err.message || '文风没有保存成功'); }
    finally { setBusy(false); }
  };

  const importStyleFile = async file => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const formData = new FormData(); formData.append('file', file);
      const extractResponse = await apiFetch(`${BACKEND}/theater/global-rules/import`, { method: 'POST', body: formData });
      const extracted = await readJson(extractResponse);
      if (!extractResponse.ok) throw new Error(extracted.error || '这个文风文件没有读出来');
      const content = String(extracted.rules || '').trim();
      if (!content) throw new Error('这个文件里没有读到文风正文。');
      const createResponse = await apiFetch(`${BACKEND}/theater/rules`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: filenameTitle(file.name), content, enabled: true, apply_scope: 'chat', source_name: STYLE_SOURCE }),
      });
      const created = await readJson(createResponse);
      if (!createResponse.ok) throw new Error(created.error || '文风没有加入文风库');
      await loadStyles(); setDraft(emptyDraft); setMobilePane('list');
    } catch (err) { setError(err.message || '文风文件没有导入成功'); }
    finally { setBusy(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const toggleStyle = async style => {
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules/${style.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !style.enabled }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '文风状态没有保存成功');
      setStyles(items => items.map(item => item.id === data.id ? data : item));
    } catch (err) { setError(err.message || '文风状态没有保存成功'); }
    finally { setBusy(false); }
  };

  const changeScope = async (style, apply_scope) => {
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules/${style.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apply_scope: normalizeScope(apply_scope) }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '文风范围没有保存成功');
      setStyles(items => items.map(item => item.id === data.id ? data : item));
    } catch (err) { setError(err.message || '文风范围没有保存成功'); }
    finally { setBusy(false); }
  };

  const deleteStyle = async style => {
    if (!window.confirm(`删除文风《${style.title || '未命名文风'}》吗？`)) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules/${style.id}`, { method: 'DELETE' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '文风没有删除成功');
      setStyles(items => items.filter(item => item.id !== style.id));
    } catch (err) { setError(err.message || '文风没有删除成功'); }
    finally { setBusy(false); }
  };

  const editStyle = style => {
    setDraft({ id: style.id, title: style.title || '', content: style.content || '', enabled: style.enabled !== false, apply_scope: normalizeScope(style.apply_scope) });
    setMobilePane('editor');
  };

  return (
    <>
      <button className="theater-rule-library-trigger is-memory knowledge-library-trigger knowledge-library-trigger--rules" type="button" onClick={() => setOpen(true)}>
        <span className="knowledge-library-trigger__icon" aria-hidden="true">文</span>
        <span className="knowledge-library-trigger__copy"><strong>文风库</strong><small>陆泽的叙事节奏、暧昧感与文字呼吸</small></span>
        <span className="knowledge-library-trigger__meta">{enabledCount} 份启用</span>
        <span className="knowledge-library-trigger__arrow" aria-hidden="true">›</span>
      </button>
      {open && (
        <div className="theater-rule-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeLibrary(); }}>
          <section className="theater-rule-library" role="dialog" aria-modal="true" aria-label="文风库">
            <header className="theater-rule-library-head">
              <div><span>OURHOME STYLE LIBRARY</span><h2>文风库</h2><p>这里放“怎么写”，不放人格和世界设定。可以上传、编辑、停用或选择生效范围。</p></div>
              <button ref={closeButtonRef} type="button" onClick={closeLibrary} aria-label="关闭文风库">×</button>
            </header>
            <div className="theater-rule-summary">
              <span><b>{styles.length}</b> 份文风</span><span><b>{enabledCount}</b> 份启用</span>
              <button type="button" onClick={loadStyles} disabled={loading || busy}>{loading ? '整理中' : '刷新'}</button>
            </div>
            {error && <div className="theater-rule-error">{error}</div>}
            <nav className="theater-rule-mobile-tabs" aria-label="文风库页面">
              <button type="button" className={mobilePane === 'list' ? 'is-active' : ''} onClick={() => setMobilePane('list')}>文风列表 <b>{styles.length}</b></button>
              <button type="button" className={`is-add ${mobilePane === 'editor' ? 'is-active' : ''}`} onClick={() => { setDraft(emptyDraft); setMobilePane('editor'); }} aria-label="新建文风">＋</button>
            </nav>
            <div className="theater-rule-library-body">
              <div className={`theater-rule-list ${mobilePane !== 'list' ? 'is-mobile-hidden' : ''}`}>
                {loading && styles.length === 0 && <div className="theater-rule-empty">正在把文风拿出来…</div>}
                {!loading && styles.length === 0 && <div className="theater-rule-empty">还没有文风。可以新建，也可以直接上传 Word、TXT 或 Markdown。</div>}
                {styles.map((style, index) => (
                  <article className={`theater-rule-card ${style.enabled ? 'is-enabled' : 'is-disabled'}`} key={style.id}>
                    <header><div><span>STYLE {String(index + 1).padStart(2, '0')}</span><h3>{style.title || '未命名文风'}</h3></div><button className={`theater-rule-switch ${style.enabled ? 'is-on' : ''}`} type="button" onClick={() => toggleStyle(style)} disabled={busy}><i /><b>{style.enabled ? '启用' : '停用'}</b></button></header>
                    <div className="theater-rule-card-scope"><span>生效范围</span><select value={normalizeScope(style.apply_scope)} onChange={event => changeScope(style, event.target.value)} disabled={busy}>{scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                    <p>{style.content}</p>
                    <footer><div /><div><button type="button" onClick={() => editStyle(style)} disabled={busy}>编辑</button><button className="is-danger" type="button" onClick={() => deleteStyle(style)} disabled={busy}>删除</button></div></footer>
                  </article>
                ))}
              </div>
              <aside className={`theater-rule-editor ${mobilePane !== 'editor' ? 'is-mobile-hidden' : ''}`}>
                <div className="theater-rule-editor-title"><div><span>{draft.id ? 'EDIT STYLE' : 'NEW STYLE'}</span><h3>{draft.id ? '修改这份文风' : '添加一份文风'}</h3></div>{draft.id && <button type="button" onClick={() => { setDraft(emptyDraft); setMobilePane('list'); }} disabled={busy}>取消编辑</button>}</div>
                <label><span>文风名称</span><input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} maxLength={80} placeholder="例如：自然沉浸式叙事" /></label>
                <label><span>文风正文</span><textarea value={draft.content} onChange={event => setDraft(current => ({ ...current, content: event.target.value }))} rows={14} maxLength={20000} placeholder="把喜欢的文风描述放在这里。" /></label>
                <fieldset className="theater-rule-scope-picker"><legend>生效范围</legend><div>{scopeOptions.map(option => <label key={option.value} className={normalizeScope(draft.apply_scope) === option.value ? 'is-selected' : ''}><input type="radio" name="luze-style-scope" value={option.value} checked={normalizeScope(draft.apply_scope) === option.value} onChange={() => setDraft(current => ({ ...current, apply_scope: option.value }))} />{option.label}</label>)}</div><p>{scopeLabel(draft.apply_scope)}，文风只影响表达方式，不替换人格或世界书。</p></fieldset>
                <div className="theater-rule-editor-meta"><label><input type="checkbox" checked={draft.enabled} onChange={event => setDraft(current => ({ ...current, enabled: event.target.checked }))} />保存后立即启用</label><span>{draft.content.length} / 20000</span></div>
                <input ref={fileInputRef} type="file" accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown" hidden onChange={event => importStyleFile(event.target.files?.[0])} />
                <div className="theater-rule-editor-actions"><button className="is-quiet" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>{busy ? '处理中' : '上传文风文件'}</button><button type="button" onClick={saveDraft} disabled={busy}>{busy ? '保存中' : draft.id ? '保存修改' : '加入文风库'}</button></div>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
