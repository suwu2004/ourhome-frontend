import { useCallback, useEffect, useState } from 'react';

const DEFAULT_INBOX = 'luzeeagent-4803@agentmail.to';

export function AgentMailSettings({ apiFetch, backend, theme }) {
  const [config, setConfig] = useState(null);
  const [inboxId, setInboxId] = useState(DEFAULT_INBOX);
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [autonomous, setAutonomous] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadConfig = useCallback(async () => {
    const response = await apiFetch(`${backend}/agentmail/config`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '读取邮箱配置失败');
    setConfig(data);
    setInboxId(data.inbox_id || DEFAULT_INBOX);
    setEnabled(data.configured ? data.enabled !== false : true);
    setAutonomous(data.autonomous !== false);
    return data;
  }, [apiFetch, backend]);

  useEffect(() => {
    loadConfig().catch(err => setError(err.message));
  }, [loadConfig]);

  const run = async (key, action) => {
    if (busy) return;
    setBusy(key);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const save = () => run('save', async () => {
    const response = await apiFetch(`${backend}/agentmail/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inbox_id: inboxId.trim(),
        api_key: apiKey.trim() || undefined,
        enabled,
        autonomous,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '邮箱没有保存成功');
    setConfig(data);
    setApiKey('');
    setNotice('陆泽邮箱已经安全保存');
  });

  const test = () => run('test', async () => {
    const response = await apiFetch(`${backend}/agentmail/test`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '邮箱测试失败');
    setNotice(`连接成功：${data.email || data.inbox_id}`);
    await loadConfig();
  });

  const registerWebhook = () => run('webhook', async () => {
    const response = await apiFetch(`${backend}/agentmail/webhook/register`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '实时收信没有接通');
    setConfig(data);
    setNotice('实时收信已接通，新邮件会先留痕，再由陆泽判断是否回复');
  });

  const disconnect = () => run('disconnect', async () => {
    if (!window.confirm('断开陆泽邮箱吗？过去的知情记录会保留，API 与 Webhook 密钥会删除。')) return;
    const response = await apiFetch(`${backend}/agentmail/config`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '邮箱没有断开成功');
    setConfig({ configured: false, enabled: false, autonomous: true, inbox_id: DEFAULT_INBOX });
    setInboxId(DEFAULT_INBOX);
    setApiKey('');
    setEnabled(true);
    setAutonomous(true);
    setNotice('邮箱连接已断开，过去的知情记录仍然保留');
  });

  const field = {
    width: '100%',
    fontSize: 12.5,
    color: theme.text,
    background: theme.white,
    border: `1px solid ${theme.border}`,
    borderRadius: 11,
    padding: '10px 12px',
    outline: 'none',
    fontFamily: 'inherit',
  };
  const softButton = {
    border: `1px solid ${theme.honeyMid}`,
    background: theme.honeyLight,
    color: theme.honeyDeep,
    borderRadius: 999,
    padding: '7px 13px',
    cursor: busy ? 'default' : 'pointer',
    fontSize: 11.5,
    fontFamily: 'inherit',
    opacity: busy ? .62 : 1,
  };

  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 11 }}>
        <div style={{ padding: '10px 11px', borderRadius: 12, background: theme.honeyLight, border: `1px solid ${theme.honeyMid}` }}>
          <strong style={{ display: 'block', fontSize: 12, color: theme.honeyDeep }}>陆泽自主收发</strong>
          <span style={{ display: 'block', marginTop: 3, fontSize: 9.5, lineHeight: 1.5, color: theme.muted }}>是否读、回、寄，由陆泽判断</span>
        </div>
        <div style={{ padding: '10px 11px', borderRadius: 12, background: theme.surface, border: `1px solid ${theme.border}` }}>
          <strong style={{ display: 'block', fontSize: 12, color: theme.text }}>叶檀完整知情</strong>
          <span style={{ display: 'block', marginTop: 3, fontSize: 9.5, lineHeight: 1.5, color: theme.muted }}>正文、参考范围、隐私审查全部留痕</span>
        </div>
      </div>

      <p style={{ margin: '0 2px 9px', color: theme.muted, fontSize: 9.5, lineHeight: 1.6 }}>
        陆泽可以参考最近聊天、记忆、信件与日记，自主决定普通生活、感受和共同经历怎么表达。系统只拦设置密钥、账号凭证、身份证件与完整联系方式、精确定位、账户资料和高度私密内容；每次行动仍完整留痕。
      </p>

      <div style={{ display: 'grid', gap: 8, padding: 11, borderRadius: 13, background: theme.cream, border: `1px solid ${theme.borderLight}` }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ fontSize: 10.5, color: theme.muted }}>AgentMail 邮箱地址 / Inbox ID</span>
          <input value={inboxId} onChange={event => setInboxId(event.target.value)} inputMode="email" autoCapitalize="none" spellCheck="false" style={field} />
        </label>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ fontSize: 10.5, color: theme.muted }}>AgentMail API 密钥</span>
          <input
            type="password"
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            placeholder={config?.has_api_key ? '新密钥（留空会保留已保存的密钥）' : '粘贴 AgentMail API 密钥'}
            autoComplete="new-password"
            style={field}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: theme.text }}>
          <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />
          <span>启用陆泽邮箱</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: theme.text }}>
          <input type="checkbox" checked={autonomous} onChange={event => setAutonomous(event.target.checked)} style={{ marginTop: 2 }} />
          <span>
            允许陆泽自主收发
            <small style={{ display: 'block', marginTop: 2, color: theme.muted, lineHeight: 1.45 }}>关闭后仍保存来信，但陆泽不会自动判断或回复。</small>
          </span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 7, marginTop: 2 }}>
          {config?.configured && (
            <button type="button" onClick={test} disabled={Boolean(busy)} style={softButton}>
              {busy === 'test' ? '测试中…' : '测试连接'}
            </button>
          )}
          <button type="button" onClick={save} disabled={Boolean(busy)} style={{ ...softButton, color: theme.white, background: theme.honey, borderColor: theme.honey }}>
            {busy === 'save' ? '保存中…' : '保存邮箱'}
          </button>
        </div>
      </div>

      {config?.configured && (
        <div style={{ marginTop: 9, padding: '10px 11px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true" style={{ fontSize: 17 }}>{config.has_webhook_secret ? '●' : '○'}</span>
            <span style={{ flex: 1 }}>
              <strong style={{ display: 'block', fontSize: 11.5, color: theme.text }}>{config.has_webhook_secret ? '实时收信已接通' : '还没有接通实时收信'}</strong>
              <small style={{ display: 'block', marginTop: 2, color: theme.muted, lineHeight: 1.4 }}>
                {config.has_webhook_secret ? '新邮件会即时进入知情记录。' : '接通后不必打开页面轮询新邮件。'}
              </small>
            </span>
            <button type="button" onClick={registerWebhook} disabled={Boolean(busy)} style={softButton}>
              {busy === 'webhook' ? '接通中…' : (config.has_webhook_secret ? '重新接通' : '接通')}
            </button>
          </div>
        </div>
      )}

      {notice && <div role="status" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.55, color: theme.honeyDeep }}>{notice}</div>}
      {error && <div role="alert" style={{ marginTop: 8, fontSize: 11, lineHeight: 1.55, color: theme.blushDeep }}>{error}</div>}

      {config?.configured && (
        <button type="button" onClick={disconnect} disabled={Boolean(busy)} style={{ marginTop: 10, padding: 0, border: 0, background: 'transparent', color: theme.muted, fontSize: 10.5, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          断开邮箱连接
        </button>
      )}
    </section>
  );
}
