import { useEffect, useState } from 'react';

export default function IntegrationSettings({ apiFetch, backend, theme }) {
  const [connections, setConnections] = useState([]);
  const [tavilyKey, setTavilyKey] = useState('');
  const [tavilyEnabled, setTavilyEnabled] = useState(true);
  const [mcpDraft, setMcpDraft] = useState({ name: '', url: '', token: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadConnections = async () => {
    try {
      const response = await apiFetch(`${backend}/connections`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '读取联网配置失败');
      const list = Array.isArray(data) ? data : [];
      setConnections(list);
      const tavily = list.find(item => item.kind === 'web_search');
      if (tavily) setTavilyEnabled(tavily.enabled);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { loadConnections(); }, []);

  const saveTavily = async () => {
    const existing = connections.find(item => item.kind === 'web_search');
    if (!existing && !tavilyKey.trim()) {
      setError('第一次保存 Tavily 时需要填写密钥');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(existing ? `${backend}/connections/${existing.id}` : `${backend}/connections`, {
        method: existing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'web_search', name: 'Tavily', url: 'https://api.tavily.com/search', secret: tavilyKey.trim() || undefined, enabled: tavilyEnabled, config: { max_results: 5, search_depth: 'advanced' } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存失败');
      setTavilyKey('');
      setNotice('联网搜索配置已保存');
      await loadConnections();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveMcp = async event => {
    event.preventDefault();
    if (!mcpDraft.name.trim() || !mcpDraft.url.trim()) {
      setError('请填写 MCP 名称和远程地址');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${backend}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'mcp', name: mcpDraft.name.trim(), url: mcpDraft.url.trim(), secret: mcpDraft.token.trim() || undefined, enabled: true, config: { read_only: true } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存 MCP 失败');
      setMcpDraft({ name: '', url: '', token: '' });
      setNotice('MCP 已保存，默认只开放服务器声明为只读的工具');
      await loadConnections();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const patchConnection = async (connection, updates) => {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`${backend}/connections/${connection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...connection, ...updates, secret: undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '更新失败');
      await loadConnections();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async connection => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await apiFetch(`${backend}/connections/${connection.id}/test`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '测试失败');
      setNotice(connection.kind === 'mcp' ? `连接成功，发现 ${data.tool_count || 0} 个只读工具` : `连接成功，返回 ${data.result_count || 0} 条结果`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeConnection = async connection => {
    if (!window.confirm(`确定删除“${connection.name}”吗？`)) return;
    setBusy(true);
    try {
      const response = await apiFetch(`${backend}/connections/${connection.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '删除失败');
      await loadConnections();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field = { width: '100%', fontSize: 12.5, color: theme.text, background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '9px 12px', outline: 'none' };
  const softButton = { border: `1px solid ${theme.honeyMid}`, background: theme.honeyLight, color: theme.honeyDeep, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontSize: 11.5 };
  const textButton = { border: 0, padding: 0, background: 'transparent', fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' };
  const mcpConnections = connections.filter(item => item.kind === 'mcp');
  const tavily = connections.find(item => item.kind === 'web_search');

  return (
    <section style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 12, color: theme.muted, marginBottom: 4, letterSpacing: '.05em' }}>联网与 MCP</div>
      <div style={{ fontSize: 10.5, color: theme.mutedLight, lineHeight: 1.55, marginBottom: 11 }}>联网由 Tavily 搜索提供；MCP 目前接远程 Streamable HTTP 地址，并默认限制为只读工具。搜索词和工具参数会发给对应服务，请只连接信任的站点。</div>

      <div style={{ padding: 11, borderRadius: 12, background: theme.cream, border: `1px solid ${theme.borderLight}`, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <strong style={{ flex: 1, fontSize: 12.5 }}>🔎 Tavily 联网搜索</strong>
          <span style={{ fontSize: 10.5, color: tavily?.has_secret ? theme.honeyDeep : theme.muted }}>{tavily?.has_secret ? '密钥已保存' : '未配置'}</span>
          <input type="checkbox" checked={tavilyEnabled} onChange={event => setTavilyEnabled(event.target.checked)} aria-label="启用 Tavily" />
        </div>
        <input aria-label="Tavily API 密钥" type="password" value={tavilyKey} onChange={event => setTavilyKey(event.target.value)} placeholder={tavily?.has_secret ? '新密钥（留空保留原密钥）' : 'Tavily API 密钥'} autoComplete="new-password" style={field} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          {tavily && <button type="button" onClick={() => testConnection(tavily)} disabled={busy} style={softButton}>测试搜索</button>}
          <button type="button" onClick={saveTavily} disabled={busy} style={{ ...softButton, color: theme.white, background: theme.honey, borderColor: theme.honey }}>{busy ? '处理中…' : '保存联网配置'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        {mcpConnections.map(connection => (
          <div key={connection.id} style={{ padding: 10, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.cream }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 12.5 }}>{connection.name}</strong>
                <small style={{ display: 'block', color: theme.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{connection.url}</small>
              </span>
              <span style={{ fontSize: 10, color: theme.honeyDeep }}>只读</span>
              <input type="checkbox" checked={connection.enabled} onChange={event => patchConnection(connection, { enabled: event.target.checked })} aria-label={`启用 ${connection.name}`} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 7, fontSize: 10.5 }}>
              <button type="button" onClick={() => testConnection(connection)} disabled={busy} style={{ ...textButton, color: theme.honeyDeep }}>测试并读取工具</button>
              <button type="button" onClick={() => removeConnection(connection)} disabled={busy} style={{ ...textButton, color: theme.muted, marginLeft: 'auto' }}>删除</button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={saveMcp} style={{ display: 'grid', gap: 8, padding: 11, borderRadius: 12, background: theme.cream, border: `1px solid ${theme.borderLight}` }}>
        <div style={{ fontSize: 11.5, fontWeight: 700 }}>添加远程 MCP</div>
        <input aria-label="MCP 名称" value={mcpDraft.name} onChange={event => setMcpDraft(value => ({ ...value, name: event.target.value }))} placeholder="名称，例如：Tavily MCP" style={field} />
        <input aria-label="MCP 地址" value={mcpDraft.url} onChange={event => setMcpDraft(value => ({ ...value, url: event.target.value }))} placeholder="https://example.com/mcp" inputMode="url" style={field} />
        <input aria-label="MCP Bearer Token" type="password" value={mcpDraft.token} onChange={event => setMcpDraft(value => ({ ...value, token: event.target.value }))} placeholder="Bearer Token（没有则留空）" autoComplete="new-password" style={field} />
        <button type="submit" disabled={busy} style={{ ...softButton, justifySelf: 'end', color: theme.white, background: theme.honey, borderColor: theme.honey }}>{busy ? '保存中…' : '保存 MCP'}</button>
      </form>

      {notice && <div role="status" style={{ marginTop: 8, fontSize: 11, color: theme.honeyDeep }}>{notice}</div>}
      {error && <div role="alert" style={{ marginTop: 8, fontSize: 11, color: theme.blushDeep }}>{error}</div>}
    </section>
  );
}
