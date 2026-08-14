import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';
import { useDialogLayer } from './useDialogLayer.js';
import './TheaterRuleLibrary.css';

const emptyDraft = {
  id: null,
  title: '',
  content: '',
  enabled: true,
  apply_scope: 'theater',
  source_name: null,
};

const scopeOptions = [
  { value: 'theater', label: '仅小剧场' },
  { value: 'chat', label: '仅 Chat' },
  { value: 'both', label: '两边都用' },
];

function normalizeScope(value) {
  return scopeOptions.some(option => option.value === value) ? value : 'theater';
}

function scopeLabel(value) {
  return scopeOptions.find(option => option.value === normalizeScope(value))?.label || '仅小剧场';
}

function scopeIncludes(value, target) {
  const scope = normalizeScope(value);
  return scope === 'both' || scope === target;
}

function filenameTitle(name) {
  return String(name || '')
    .replace(/\.(?:docx|txt|md)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '导入的规则';
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function RuleCard({ rule, index, count, busy, onEdit, onToggle, onScope, onDelete, onMove }) {
  return (
    <article className={`theater-rule-card ${rule.enabled ? 'is-enabled' : 'is-disabled'}`}>
      <header>
        <div>
          <span>RULE {String(index + 1).padStart(2, '0')}</span>
          <h3>{rule.title || '未命名规则'}</h3>
        </div>
        <button
          className={`theater-rule-switch ${rule.enabled ? 'is-on' : ''}`}
          type="button"
          onClick={() => onToggle(rule)}
          disabled={busy}
          aria-label={rule.enabled ? `停用${rule.title}` : `启用${rule.title}`}
        >
          <i />
          <b>{rule.enabled ? '启用' : '停用'}</b>
        </button>
      </header>
      <div className="theater-rule-card-scope">
        <span>生效范围</span>
        <select
          value={normalizeScope(rule.apply_scope)}
          onChange={event => onScope(rule, event.target.value)}
          disabled={busy}
          aria-label={`${rule.title || '未命名规则'}的生效范围`}
        >
          {scopeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <p>{rule.content}</p>
      <footer>
        <div className="theater-rule-order" aria-label="调整规则顺序">
          <button type="button" onClick={() => onMove(index, -1)} disabled={busy || index === 0} aria-label="上移">↑</button>
          <button type="button" onClick={() => onMove(index, 1)} disabled={busy || index === count - 1} aria-label="下移">↓</button>
        </div>
        <div>
          <button type="button" onClick={() => onEdit(rule)} disabled={busy}>编辑</button>
          <button className="is-danger" type="button" onClick={() => onDelete(rule)} disabled={busy}>删除</button>
        </div>
      </footer>
    </article>
  );
}

export default function TheaterRuleLibrary() {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [mobilePane, setMobilePane] = useState('list');
  const fileInputRef = useRef(null);
  const closeButtonRef = useRef(null);

  const enabledCount = useMemo(() => rules.filter(rule => rule.enabled).length, [rules]);
  const enabledChars = useMemo(
    () => rules.filter(rule => rule.enabled).reduce((sum, rule) => sum + String(rule.content || '').length, 0),
    [rules],
  );
  const theaterCount = useMemo(
    () => rules.filter(rule => rule.enabled && scopeIncludes(rule.apply_scope, 'theater')).length,
    [rules],
  );
  const chatCount = useMemo(
    () => rules.filter(rule => rule.enabled && scopeIncludes(rule.apply_scope, 'chat')).length,
    [rules],
  );

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules`);
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '通用规则库没有打开');
      setRules(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch (err) {
      setError(err.message || '通用规则库没有打开');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadRules();
  }, [loadRules, open]);

  const closeLibrary = useCallback(() => setOpen(false), []);
  useDialogLayer(open, closeLibrary, closeButtonRef);

  const resetDraft = () => setDraft(emptyDraft);

  const startNewRule = () => {
    resetDraft();
    setMobilePane('editor');
    setError('');
  };

  const editRule = rule => {
    setDraft({
      id: rule.id,
      title: rule.title || '',
      content: rule.content || '',
      enabled: rule.enabled !== false,
      apply_scope: normalizeScope(rule.apply_scope),
      source_name: rule.source_name || null,
    });
    setMobilePane('editor');
    requestAnimationFrame(() => document.querySelector('.theater-rule-editor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };

  const saveDraft = async () => {
    const title = draft.title.trim();
    const content = draft.content.trim();
    if (!title) {
      setError('先给这条规则取一个名字。');
      return;
    }
    if (!content) {
      setError('规则正文还没有写。');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules${draft.id ? `/${draft.id}` : ''}`, {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          enabled: draft.enabled,
          apply_scope: normalizeScope(draft.apply_scope),
          source_name: draft.source_name,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '这条规则没有保存成功');
      await loadRules();
      resetDraft();
      setMobilePane('list');
    } catch (err) {
      setError(err.message || '这条规则没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const importRuleFile = async file => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const extractResponse = await apiFetch(`${BACKEND}/theater/global-rules/import`, {
        method: 'POST',
        body: formData,
      });
      const extracted = await readJson(extractResponse);
      if (!extractResponse.ok) throw new Error(extracted.error || '这个规则文件没有读出来');
      const content = String(extracted.rules || '').trim();
      if (!content) throw new Error('这个文件里没有读到规则正文。');

      const createResponse = await apiFetch(`${BACKEND}/theater/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: filenameTitle(file.name),
          content,
          enabled: true,
          apply_scope: 'theater',
          source_name: file.name,
        }),
      });
      const created = await readJson(createResponse);
      if (!createResponse.ok) throw new Error(created.error || '这份规则没有加入规则库');
      await loadRules();
      setDraft(emptyDraft);
      setMobilePane('list');
    } catch (err) {
      setError(err.message || '规则文件没有导入成功');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleRule = async rule => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '规则状态没有保存成功');
      setRules(items => items.map(item => (item.id === data.id ? data : item)));
      if (draft.id === data.id) setDraft(current => ({ ...current, enabled: data.enabled }));
    } catch (err) {
      setError(err.message || '规则状态没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const changeRuleScope = async (rule, applyScope) => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apply_scope: normalizeScope(applyScope) }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '规则范围没有保存成功');
      setRules(items => items.map(item => (item.id === data.id ? data : item)));
      if (draft.id === data.id) setDraft(current => ({ ...current, apply_scope: normalizeScope(data.apply_scope) }));
    } catch (err) {
      setError(err.message || '规则范围没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  const deleteRule = async rule => {
    if (!window.confirm(`删除规则《${rule.title || '未命名规则'}》吗？`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules/${rule.id}`, { method: 'DELETE' });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '这条规则没有删除成功');
      setRules(items => items.filter(item => item.id !== rule.id));
      if (draft.id === rule.id) resetDraft();
    } catch (err) {
      setError(err.message || '这条规则没有删除成功');
    } finally {
      setBusy(false);
    }
  };

  const moveRule = async (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= rules.length) return;
    const reordered = [...rules];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setRules(reordered);
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/theater/rules/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map(rule => rule.id) }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '规则顺序没有保存成功');
      setRules(Array.isArray(data) ? data : reordered);
    } catch (err) {
      setRules(rules);
      setError(err.message || '规则顺序没有保存成功');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="theater-rule-library-trigger is-memory knowledge-library-trigger knowledge-library-trigger--rules" type="button" onClick={() => setOpen(true)}>
        <span className="knowledge-library-trigger__icon" aria-hidden="true">规</span>
        <span className="knowledge-library-trigger__copy"><strong>规则库</strong><small>表达、行为、禁区与叙事规范</small></span>
        <span className="knowledge-library-trigger__meta">{loaded ? `${enabledCount} 条启用` : '打开管理'}</span>
        <span className="knowledge-library-trigger__arrow" aria-hidden="true">›</span>
      </button>
      {open && (
        <div className="theater-rule-layer" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) closeLibrary();
        }}>
          <section className="theater-rule-library" role="dialog" aria-modal="true" aria-label="规则库">
            <header className="theater-rule-library-head">
              <div>
                <span>OURHOME RULE LIBRARY</span>
                <h2>规则库</h2>
                <p>规则管表达与行为，每条都能单独选择只进小剧场、只进 Chat，或者两边共同使用。</p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={closeLibrary} aria-label="关闭规则库">×</button>
            </header>

            <div className="theater-rule-summary">
              <span><b>{rules.length}</b> 条规则</span>
              <span><b>{enabledCount}</b> 条启用</span>
              <span><b>{theaterCount}</b> 条用于小剧场</span>
              <span><b>{chatCount}</b> 条用于 Chat</span>
              <span><b>{enabledChars}</b> 字生效中</span>
              <button type="button" onClick={loadRules} disabled={loading || busy}>{loading ? '整理中' : '刷新'}</button>
            </div>

            {error && <div className="theater-rule-error">{error}</div>}

            <nav className="theater-rule-mobile-tabs" aria-label="规则库页面">
              <button type="button" className={mobilePane === 'list' ? 'is-active' : ''} onClick={() => setMobilePane('list')}>规则列表 <b>{rules.length}</b></button>
              <button type="button" className={mobilePane === 'editor' ? 'is-active' : ''} onClick={() => setMobilePane('editor')}>{draft.id ? '编辑规则' : '添加规则'}</button>
              <button type="button" onClick={startNewRule} aria-label="新建规则">＋</button>
            </nav>

            <div className="theater-rule-library-body">
              <div className={`theater-rule-list ${mobilePane !== 'list' ? 'is-mobile-hidden' : ''}`}>
                {loading && rules.length === 0 && <div className="theater-rule-empty">正在把规则卡片拿出来…</div>}
                {!loading && rules.length === 0 && <div className="theater-rule-empty">规则库还是空的。右边可以新建，也可以直接上传 Word。</div>}
                {rules.map((rule, index) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    index={index}
                    count={rules.length}
                    busy={busy}
                    onEdit={editRule}
                    onToggle={toggleRule}
                    onScope={changeRuleScope}
                    onDelete={deleteRule}
                    onMove={moveRule}
                  />
                ))}
              </div>

              <aside className={`theater-rule-editor ${mobilePane !== 'editor' ? 'is-mobile-hidden' : ''}`}>
                <div className="theater-rule-editor-title">
                  <div>
                    <span>{draft.id ? 'EDIT RULE' : 'NEW RULE'}</span>
                    <h3>{draft.id ? '修改这条规则' : '添加一条规则'}</h3>
                  </div>
                  {draft.id && <button type="button" onClick={() => { resetDraft(); setMobilePane('list'); }} disabled={busy}>取消编辑</button>}
                </div>

                <label>
                  <span>规则名称</span>
                  <input
                    value={draft.title}
                    onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                    maxLength={80}
                    placeholder="例如：亲吻细节、语言表达、电影叙事"
                  />
                </label>

                <label>
                  <span>规则正文</span>
                  <textarea
                    value={draft.content}
                    onChange={event => setDraft(current => ({ ...current, content: event.target.value }))}
                    rows={12}
                    maxLength={20000}
                    placeholder="把这一类写作规则完整放在这里。它会作为独立卡片保存，不会覆盖其他规则。"
                  />
                </label>

                <fieldset className="theater-rule-scope-picker">
                  <legend>生效范围</legend>
                  <div>
                    {scopeOptions.map(option => (
                      <label key={option.value} className={normalizeScope(draft.apply_scope) === option.value ? 'is-selected' : ''}>
                        <input
                          type="radio"
                          name="theater-rule-scope"
                          value={option.value}
                          checked={normalizeScope(draft.apply_scope) === option.value}
                          onChange={() => setDraft(current => ({ ...current, apply_scope: option.value }))}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  <p>{scopeLabel(draft.apply_scope)}，只会进入对应房间的提示词，剧场记忆始终不会进入 Chat。</p>
                </fieldset>

                <div className="theater-rule-editor-meta">
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={event => setDraft(current => ({ ...current, enabled: event.target.checked }))}
                    />
                    保存后立即启用
                  </label>
                  <span>{draft.content.length} / 20000</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                  hidden
                  onChange={event => importRuleFile(event.target.files?.[0])}
                />
                <div className="theater-rule-editor-actions">
                  <button className="is-quiet" type="button" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                    {busy ? '处理中' : '上传一份 Word'}
                  </button>
                  <button type="button" onClick={saveDraft} disabled={busy}>
                    {busy ? '保存中' : draft.id ? '保存修改' : '加入规则库'}
                  </button>
                </div>
                <p className="theater-rule-editor-note">新上传的规则默认仅用于小剧场。停用只会让它暂时退出提示词，内容和生效范围仍会保留。</p>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
