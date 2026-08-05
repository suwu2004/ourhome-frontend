import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, BACKEND } from './api.js';
import './TheaterRuleLibrary.css';

const emptyDraft = {
  id: null,
  title: '',
  content: '',
  enabled: true,
  source_name: null,
};

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

function RuleCard({ rule, index, count, busy, onEdit, onToggle, onDelete, onMove }) {
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
  const [toolbarTarget, setToolbarTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const hiddenButtonsRef = useRef([]);

  const enabledCount = useMemo(() => rules.filter(rule => rule.enabled).length, [rules]);
  const enabledChars = useMemo(
    () => rules.filter(rule => rule.enabled).reduce((sum, rule) => sum + String(rule.content || '').length, 0),
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
    } catch (err) {
      setError(err.message || '通用规则库没有打开');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    const locateToolbar = () => {
      const buttons = [...document.querySelectorAll('button')];
      const importButton = buttons.find(button => button.textContent?.trim() === '导入世界');
      const duplicateButtons = buttons.filter(button => {
        const text = button.textContent?.replace(/\s+/g, ' ').trim();
        return text === '通用规则' || text === '＋ 新书' || text === '+ 新书' || text === '+新书';
      });

      duplicateButtons.forEach(button => {
        if (button.dataset.theaterRuleLibraryHidden === 'true') return;
        button.dataset.theaterRuleLibraryHidden = 'true';
        button.dataset.theaterRuleLibraryDisplay = button.style.display || '';
        button.style.setProperty('display', 'none', 'important');
        hiddenButtonsRef.current.push(button);
      });

      if (importButton?.parentElement && toolbarTarget !== importButton.parentElement) {
        setToolbarTarget(importButton.parentElement);
      }
    };

    locateToolbar();
    const observer = new MutationObserver(locateToolbar);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      hiddenButtonsRef.current.forEach(button => {
        if (!button?.isConnected) return;
        const previous = button.dataset.theaterRuleLibraryDisplay || '';
        button.style.display = previous;
        delete button.dataset.theaterRuleLibraryHidden;
        delete button.dataset.theaterRuleLibraryDisplay;
      });
      hiddenButtonsRef.current = [];
    };
  }, [toolbarTarget]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const resetDraft = () => setDraft(emptyDraft);

  const editRule = rule => {
    setDraft({
      id: rule.id,
      title: rule.title || '',
      content: rule.content || '',
      enabled: rule.enabled !== false,
      source_name: rule.source_name || null,
    });
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
          source_name: draft.source_name,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || '这条规则没有保存成功');
      await loadRules();
      resetDraft();
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
          source_name: file.name,
        }),
      });
      const created = await readJson(createResponse);
      if (!createResponse.ok) throw new Error(created.error || '这份规则没有加入规则库');
      await loadRules();
      setDraft(emptyDraft);
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

  const trigger = toolbarTarget
    ? createPortal(
      <button className="theater-rule-library-trigger" type="button" onClick={() => setOpen(true)}>
        <span>规则库</span>
        <b>{enabledCount}</b>
      </button>,
      toolbarTarget,
    )
    : null;

  return (
    <>
      {trigger}
      {open && (
        <div className="theater-rule-layer" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="theater-rule-library" role="dialog" aria-modal="true" aria-label="小剧场通用规则库">
            <header className="theater-rule-library-head">
              <div>
                <span>THEATER RULE LIBRARY</span>
                <h2>小剧场通用规则库</h2>
                <p>每条规则单独保存。启用的规则会按顺序一起进入所有小世界。</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭规则库">×</button>
            </header>

            <div className="theater-rule-summary">
              <span><b>{rules.length}</b> 条规则</span>
              <span><b>{enabledCount}</b> 条启用</span>
              <span><b>{enabledChars}</b> 字生效中</span>
              <button type="button" onClick={loadRules} disabled={loading || busy}>{loading ? '整理中' : '刷新'}</button>
            </div>

            {error && <div className="theater-rule-error">{error}</div>}

            <div className="theater-rule-library-body">
              <div className="theater-rule-list">
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
                    onDelete={deleteRule}
                    onMove={moveRule}
                  />
                ))}
              </div>

              <aside className="theater-rule-editor">
                <div className="theater-rule-editor-title">
                  <div>
                    <span>{draft.id ? 'EDIT RULE' : 'NEW RULE'}</span>
                    <h3>{draft.id ? '修改这条规则' : '添加一条规则'}</h3>
                  </div>
                  {draft.id && <button type="button" onClick={resetDraft} disabled={busy}>取消编辑</button>}
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
                <p className="theater-rule-editor-note">上传第二份、第三份文件都会新增卡片，不再替换前一份。停用只是不让它进入提示词，内容仍会保留。</p>
              </aside>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
