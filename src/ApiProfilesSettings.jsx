import { useEffect, useMemo, useState } from 'react';

const emptyDraft = () => ({ id: null, name: '', base_url: '', api_key: '', selected_model: '' });

export default function ApiProfilesSettings({ apiFetch, backend, theme, onActiveChange, onModelsChange }) {
  const [profiles, setProfiles] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState([]);
  const [modelsBusy, setModelsBusy] = useState(false);

  const active = useMemo(() => profiles.find(profile => profile.is_active) || null, [profiles]);

  const loadProfiles = async () => {
    try {
      const response = await apiFetch(`${backend}/api-profiles`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '读取 API 站点失败');
      const list = Array.isArray(data) ? data : [];
      setProfiles(list);
      const current = list.find(profile => profile.is_active);
      if (current) onActiveChange?.(current);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { loadProfiles(); }, []);

  const editProfile = profile => {
    setDraft({
      id: profile.id,
      name: profile.name || '',
      base_url: profile.base_url || '',
      api_key: '',
      selected_model: profile.selected_model || '',
    });
    setModels([]);
    setError('');
  };

  const saveProfile = async event => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.base_url.trim()) {
      setError('请填写站点名称和 API 网址');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const url = draft.id ? `${backend}/api-profiles/${draft.id}` : `${backend}/api-profiles`;
      const response = await apiFetch(url, {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          base_url: draft.base_url.trim(),
          api_key: draft.api_key.trim() || undefined,
          selected_model: draft.selected_model.trim() || null,
          make_active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      setDraft(emptyDraft());
      setModels([]);
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const activateProfile = async profile => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${backend}/api-profiles/${profile.id}/activate`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '切换失败');
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeProfile = async profile => {
    if (!window.confirm(`确定删除“${profile.name}”吗？`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${backend}/api-profiles/${profile.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '删除失败');
      if (draft.id === profile.id) setDraft(emptyDraft());
      await loadProfiles();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const fetchModels = async () => {
    if (!draft.id) {
      setError('先保存这个站点，再拉取它支持的模型');
      return;
    }
    setModelsBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${backend}/api-profiles/${draft.id}/models`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '模型拉取失败');
      const nextModels = Array.isArray(data.models) ? data.models : [];
      setModels(nextModels);
      if (draft.id === active?.id) onModelsChange?.(nextModels);
    } catch (err) {
      setError(err.message);
    } finally {
      setModelsBusy(false);
    }
  };

  const field = { width: '100%', fontSize: 12.5, color: theme.text, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '9px 12px', outline: 'none' };
  const pill = { border: `1px solid ${theme.honeyMid}`, background: theme.honeyLight, color: theme.honeyDeep, borderRadius: 999, padding: '5px 11px', cursor: 'pointer', fontSize: 11.5 };
  const textButton = { border: 0, padding: 0, background: 'transparent', fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <section style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <div>
          <div style={{ fontSize: 12, color: theme.muted, letterSpacing: '.05em' }}>API 站点档案</div>
          <div style={{ fontSize: 10.5, color: theme.mutedLight, marginTop: 3 }}>密钥只保存在服务端，页面不会再把原文读回来</div>
        </div>
        <button type="button" onClick={() => { setDraft(emptyDraft()); setModels([]); setError(''); }} style={pill}>＋ 新站点</button>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {profiles.length === 0 && <div style={{ fontSize: 11.5, color: theme.muted }}>还没有保存过站点。</div>}
        {profiles.map(profile => (
          <div key={profile.id} style={{ padding: '10px 11px', border: `1px solid ${profile.is_active ? theme.honey : theme.border}`, borderRadius: 12, background: profile.is_active ? theme.honeyLight : theme.cream }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</strong>
                <small style={{ display: 'block', color: theme.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{profile.base_url}</small>
              </span>
              {profile.is_active && <span style={{ fontSize: 10, color: theme.honeyDeep }}>使用中</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7, fontSize: 10.5 }}>
              <span style={{ color: profile.has_api_key ? theme.muted : theme.blushDeep }}>{profile.has_api_key ? '密钥已保存' : '没有密钥'}</span>
              <button type="button" onClick={() => editProfile(profile)} style={{ ...textButton, color: theme.honeyDeep }}>编辑</button>
              {!profile.is_active && <button type="button" onClick={() => activateProfile(profile)} disabled={busy} style={{ ...textButton, color: theme.honeyDeep }}>切换到这里</button>}
              <button type="button" onClick={() => removeProfile(profile)} disabled={busy} style={{ ...textButton, color: theme.muted, marginLeft: 'auto' }}>删除</button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={saveProfile} style={{ display: 'grid', gap: 8, padding: 11, borderRadius: 12, background: theme.cream, border: `1px solid ${theme.borderLight}` }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: theme.text }}>{draft.id ? '编辑站点' : '保存新站点'}</div>
        <input aria-label="站点名称" value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} placeholder="站点名称，例如：日常线路" style={field} />
        <input aria-label="API 网址" value={draft.base_url} onChange={event => setDraft(value => ({ ...value, base_url: event.target.value }))} placeholder="API 网址，例如：https://example.com/v1" inputMode="url" style={field} />
        <input aria-label="API 密钥" type="password" value={draft.api_key} onChange={event => setDraft(value => ({ ...value, api_key: event.target.value }))} placeholder={draft.id ? '新密钥（留空会保留原密钥）' : 'API 密钥'} autoComplete="new-password" style={field} />
        <input aria-label="默认模型" value={draft.selected_model} onChange={event => setDraft(value => ({ ...value, selected_model: event.target.value }))} placeholder="默认模型（也可以拉取后选择）" style={field} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" onClick={fetchModels} disabled={modelsBusy} style={{ ...pill, opacity: modelsBusy ? .6 : 1 }}>{modelsBusy ? '拉取中…' : '拉取模型'}</button>
          <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 999, padding: '7px 16px', color: theme.white, background: `linear-gradient(150deg, ${theme.honey}, ${theme.honeyDeep})`, cursor: busy ? 'default' : 'pointer', fontSize: 12 }}>{busy ? '保存中…' : '保存并切换'}</button>
        </div>
        {models.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {models.map(model => <button type="button" key={model} onClick={() => setDraft(value => ({ ...value, selected_model: model }))} style={{ ...pill, background: draft.selected_model === model ? theme.honey : theme.honeyLight, color: draft.selected_model === model ? theme.white : theme.honeyDeep }}>{model}</button>)}
          </div>
        )}
      </form>

      {error && <div role="alert" style={{ marginTop: 8, fontSize: 11, color: theme.blushDeep }}>{error}</div>}
      {active && <div style={{ marginTop: 8, fontSize: 10.5, color: theme.mutedLight }}>当前：{active.name}{active.selected_model ? ` · ${active.selected_model}` : ''}</div>}
    </section>
  );
}
