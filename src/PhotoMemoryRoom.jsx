import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';

const emptyDraft = {
  title: '',
  image_url: '',
  kind: 'memory',
  date: '',
  place: '',
  description: '',
  relation_to_luze: '',
  tags: '',
};

const kindOptions = [
  ['person', '我的样子'],
  ['place', '去过哪里'],
  ['object', '物品'],
  ['home', '家里相关'],
  ['memory', '一段回忆'],
];

function toTagText(tags) {
  return Array.isArray(tags) ? tags.join('，') : String(tags || '');
}

function draftFromMemory(memory) {
  return {
    title: memory?.title || '',
    image_url: memory?.image_url || '',
    kind: memory?.kind || 'memory',
    date: memory?.date || '',
    place: memory?.place || '',
    description: memory?.description || '',
    relation_to_luze: memory?.relation_to_luze || '',
    tags: toTagText(memory?.tags),
  };
}

function payloadFromDraft(draft) {
  return {
    ...draft,
    title: draft.title.trim(),
    image_url: draft.image_url.trim(),
    date: draft.date.trim(),
    place: draft.place.trim(),
    description: draft.description.trim(),
    relation_to_luze: draft.relation_to_luze.trim(),
    tags: draft.tags,
  };
}

export function PhotoMemoryRoom({ visible, theme, leaveRoom }) {
  const C = theme;
  const fileInputRef = useRef(null);
  const [memories, setMemories] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showComposer, setShowComposer] = useState(false);

  const filteredMemories = useMemo(() => (
    filter === 'all' ? memories : memories.filter(item => item.kind === filter)
  ), [filter, memories]);

  const loadMemories = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/photo-memories`);
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data?.error || '照片记忆没有回来');
      setMemories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || '照片记忆没有回来');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) loadMemories();
  }, [visible]);

  const uploadPhoto = async file => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('这次先放照片图片文件。');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '照片没有上传成功');
      setDraft(current => ({ ...current, image_url: data.url, title: current.title || data.name?.replace(/\.[^.]+$/, '') || '' }));
    } catch (err) {
      setError(err.message || '照片没有上传成功');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveMemory = async event => {
    event.preventDefault();
    const payload = payloadFromDraft(draft);
    if (!payload.title && !payload.image_url && !payload.description) {
      setError('至少放一张照片，或者写一点想让陆泽记住的描述。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/photo-memories${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '照片记忆没有保存好');
      setDraft(emptyDraft);
      setEditingId(null);
      setShowComposer(false);
      await loadMemories();
    } catch (err) {
      setError(err.message || '照片记忆没有保存好');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = memory => {
    setEditingId(memory.id);
    setDraft(draftFromMemory(memory));
    setShowComposer(true);
  };

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setError('');
    setShowComposer(true);
  };

  const deleteMemory = async memory => {
    if (!window.confirm(`删除「${memory.title || '这条照片记忆'}」吗？`)) return;
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/photo-memories/${memory.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '删除失败');
      setMemories(items => items.filter(item => item.id !== memory.id));
      if (String(editingId) === String(memory.id)) {
        setEditingId(null);
        setDraft(emptyDraft);
      }
    } catch (err) {
      setError(err.message || '删除失败');
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none', transition: 'opacity .4s ease', background: `linear-gradient(180deg, ${C.cream}, ${C.surface})` }}>
      <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={leaveRoom} aria-label="回到主页" style={{ border: 0, background: 'transparent', fontSize: 18, color: C.honeyDeep, cursor: 'pointer', padding: 4 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '.05em' }}>光影相册</div>
          <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: '.16em' }}>photo memories</div>
        </div>
        <button type="button" onClick={startCreate} aria-label="上传照片" style={{ ...pillButton(C), width: 46, height: 46, padding: 0, fontSize: 25, lineHeight: 1 }}>＋</button>
      </header>

      {showComposer && (
        <div role="dialog" aria-modal="true" aria-label="上传照片" style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'grid', placeItems: 'end center', background: 'rgba(44, 31, 18, .18)', padding: '16px min(18px, 4vw) max(18px, env(safe-area-inset-bottom))' }}>
          <form onSubmit={saveMemory} style={{ width: 'min(100%, 520px)', maxHeight: 'min(82dvh, 660px)', overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 22, background: C.white, padding: 16, boxShadow: `0 22px 54px ${C.borderLight}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <b style={{ color: C.text, fontSize: 16 }}>{editingId ? '修改照片' : '上传照片'}</b>
                <div style={{ color: C.mutedLight, fontSize: 10.5, marginTop: 2 }}>写一个名字，再留一段描述。</div>
              </div>
              <button type="button" onClick={() => { setShowComposer(false); setEditingId(null); setDraft(emptyDraft); }} aria-label="关闭" style={{ border: 0, background: 'transparent', color: C.muted, fontSize: 21, cursor: 'pointer' }}>×</button>
            </div>
            <input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="命名，比如：戒指、泽叽、我的样子" style={{ ...inputStyle(C), width: '100%' }} />
            <textarea value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="描述一下这张照片，想让陆泽记住什么。" rows={4} style={{ ...inputStyle(C), width: '100%', resize: 'vertical', borderRadius: 15, marginTop: 10 }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ width: '100%', minHeight: 210, marginTop: 12, border: `1.5px dashed ${C.honeyMid}`, borderRadius: 18, background: draft.image_url ? `url(${draft.image_url}) center / cover` : `linear-gradient(145deg, ${C.honeyLight}, ${C.surface})`, color: draft.image_url ? C.white : C.honeyDeep, boxShadow: `inset 0 0 0 999px ${draft.image_url ? 'rgba(46,31,18,.12)' : 'transparent'}`, fontFamily: 'inherit', cursor: uploading ? 'default' : 'pointer', display: 'grid', placeItems: 'center', fontSize: 16 }}>
              <span style={{ borderRadius: 999, background: draft.image_url ? 'rgba(255,255,255,.84)' : 'transparent', color: C.honeyDeep, padding: draft.image_url ? '7px 13px' : 0 }}>{uploading ? '上传中…' : draft.image_url ? '更换照片' : '放照片'}</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={event => uploadPhoto(event.target.files?.[0])} />
            {error && <div role="alert" style={{ color: C.blushDeep, fontSize: 12, marginTop: 10 }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 13 }}>
              <button type="button" onClick={() => { setShowComposer(false); setEditingId(null); setDraft(emptyDraft); }} style={pillButton(C)}>取消</button>
              <button type="submit" disabled={saving} style={{ ...pillButton(C), border: 0, background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, color: C.white }}>{saving ? '保存中' : editingId ? '保存修改' : '存进相册'}</button>
            </div>
          </form>
        </div>
      )}

      <main className="ourhome-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px min(18px, 4vw) 28px' }}>
        <section style={{ maxWidth: 920, margin: '0 auto', display: 'grid', gap: 14 }}>
          <section style={{ border: `1px solid ${C.border}`, borderRadius: 20, background: C.white, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div><b style={{ color: C.text }}>我们的照片记忆</b><div style={{ color: C.mutedLight, fontSize: 10, marginTop: 2 }}>{memories.length} 条小锚点</div></div>
              <select value={filter} onChange={event => setFilter(event.target.value)} style={{ ...inputStyle(C), width: 124, paddingTop: 7, paddingBottom: 7 }}>
                <option value="all">全部</option>
                {kindOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
            </div>
            {error && <div style={{ color: C.blushDeep, fontSize: 12, marginBottom: 9 }}>{error}</div>}
            {!loading && filteredMemories.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '26px 0' }}>这里还空着。先把第一张照片和它背后的故事放进来。</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
              {filteredMemories.map(memory => (
                <article key={memory.id} style={{ overflow: 'hidden', border: `1px solid ${C.borderLight}`, borderRadius: 16, background: C.surface }}>
                  {memory.image_url ? (
                    <img src={memory.image_url} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', background: C.honeyLight, color: C.honeyDeep, fontSize: 12 }}>没有照片预览</div>
                  )}
                  <div style={{ padding: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <b style={{ color: C.text, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{memory.title}</b>
                      <span style={{ color: C.honeyDeep, background: C.honeyLight, borderRadius: 999, padding: '2px 7px', fontSize: 10, flexShrink: 0 }}>{kindOptions.find(([value]) => value === memory.kind)?.[1] || '回忆'}</span>
                    </div>
                    {(memory.place || memory.date) && <div style={{ color: C.mutedLight, fontSize: 10.5, marginTop: 5 }}>{[memory.place, memory.date].filter(Boolean).join(' · ')}</div>}
                    {memory.description && <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 12, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{memory.description}</p>}
                    {memory.relation_to_luze && <p style={{ margin: '6px 0 0', color: C.honeyDeep, fontSize: 11.5, lineHeight: 1.55 }}>{memory.relation_to_luze}</p>}
                    {memory.tags?.length > 0 && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 9 }}>{memory.tags.slice(0, 4).map(tag => <span key={tag} style={{ color: C.muted, background: C.white, border: `1px solid ${C.borderLight}`, borderRadius: 999, padding: '2px 7px', fontSize: 10 }}>{tag}</span>)}</div>}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                      <button type="button" onClick={() => startEdit(memory)} style={linkButton(C)}>编辑</button>
                      <button type="button" onClick={() => deleteMemory(memory)} style={linkButton(C)}>删除</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

function inputStyle(C) {
  return {
    boxSizing: 'border-box',
    border: `1.5px solid ${C.border}`,
    borderRadius: 999,
    background: C.surface,
    color: C.text,
    padding: '9px 11px',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 13,
  };
}

function pillButton(C) {
  return {
    border: `1px solid ${C.border}`,
    borderRadius: 999,
    background: C.surface,
    color: C.honeyDeep,
    padding: '8px 12px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  };
}

function linkButton(C) {
  return {
    border: 0,
    background: 'transparent',
    color: C.honeyDeep,
    fontFamily: 'inherit',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
  };
}
