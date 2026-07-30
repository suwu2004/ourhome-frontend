import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, BACKEND } from './api.js';

function formatCallTime(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function normalizeTranscript(value) {
  return Array.isArray(value)
    ? value.filter(item => item && (item.role === 'me' || item.role === 'ai') && String(item.text || '').trim())
    : [];
}

export function PhoneRoom({ theme, sessionId, selectedModel, partnerAvatar, onHome, onOpenChat }) {
  const C = theme;
  const [call, setCall] = useState(null);
  const [draft, setDraft] = useState('');
  const [calling, setCalling] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [summary, setSummary] = useState('');
  const listRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcript = useMemo(() => normalizeTranscript(call?.transcript), [call]);
  const speechSupported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [transcript.length, thinking]);

  useEffect(() => () => {
    try { recognitionRef.current?.stop?.(); } catch {}
  }, []);

  const startCall = async () => {
    if (calling || call?.status === 'active') return call;
    setCalling(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/phone-calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '电话没有接通');
      setCall(data);
      return data;
    } catch (err) {
      setError(err.message || '电话没有接通');
      return null;
    } finally {
      setCalling(false);
    }
  };

  const sendTurn = async () => {
    const text = draft.trim();
    if (!text || thinking || ending) return;
    let activeCall = call?.status === 'active' ? call : null;
    if (!activeCall) activeCall = await startCall();
    if (!activeCall) return;
    setDraft('');
    setThinking(true);
    setError('');
    const optimisticAt = new Date().toISOString();
    setCall(current => ({
      ...(current || activeCall),
      transcript: [...normalizeTranscript((current || activeCall).transcript), { role: 'me', text, createdAt: optimisticAt }],
    }));
    try {
      const response = await apiFetch(`${BACKEND}/phone-calls/${activeCall.id}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, model: selectedModel }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '电话那边暂时没接上');
      setCall(data.call);
    } catch (err) {
      setError(err.message || '电话那边暂时没接上');
    } finally {
      setThinking(false);
    }
  };

  const endCall = async () => {
    if (!call?.id || ending) {
      onHome?.();
      return;
    }
    setEnding(true);
    setError('');
    try {
      const response = await apiFetch(`${BACKEND}/phone-calls/${call.id}/end`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '通话摘要没有生成成功');
      setCall(data);
      setSummary(data.summary || '');
      if (data.summary_message_id) onOpenChat?.(data.summary_message_id);
    } catch (err) {
      setError(err.message || '通话摘要没有生成成功');
    } finally {
      setEnding(false);
    }
  };

  const startSpeechInput = () => {
    if (!speechSupported || listening) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError('这台设备暂时没有听清，可以手动输入。');
    };
    recognition.onresult = event => {
      const text = Array.from(event.results || [])
        .map(result => result?.[0]?.transcript || '')
        .join('')
        .trim();
      if (text) setDraft(current => `${current}${current ? ' ' : ''}${text}`);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: `radial-gradient(circle at 50% 18%, ${C.honeyLight}, transparent 38%), ${C.cream}` }}>
      <header className="ourhome-safe-top" style={{ background: 'rgba(255,255,255,.72)', borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(14px)' }}>
        <button type="button" onClick={onHome} aria-label="回到主页" style={{ fontSize: 18, color: C.honeyDeep, background: 'transparent', border: 0, padding: 4, width: 32, height: 32, cursor: 'pointer' }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>和陆泽通话</div>
          <div style={{ marginTop: 2, fontSize: 10, color: call?.status === 'active' ? C.honeyDeep : C.muted, letterSpacing: '.16em' }}>{call?.status === 'active' ? 'connected' : 'phone room'}</div>
        </div>
        <button type="button" onClick={endCall} disabled={ending} style={{ minWidth: 48, minHeight: 32, border: 0, borderRadius: 999, background: call?.status === 'active' ? C.blushDeep : C.honeyLight, color: call?.status === 'active' ? C.white : C.honeyDeep, cursor: ending ? 'default' : 'pointer', opacity: ending ? .7 : 1, fontFamily: 'inherit', fontSize: 12 }}>{ending ? '收尾…' : call?.status === 'active' ? '挂断' : '离开'}</button>
      </header>

      <main ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '22px 18px 12px' }}>
        <section style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 88, height: 88, margin: '0 auto 10px', borderRadius: '50%', display: 'grid', placeItems: 'center', overflow: 'hidden', background: `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, border: `4px solid ${C.white}`, boxShadow: '0 14px 38px rgba(185,122,31,.24)' }}>
            {partnerAvatar ? <img src={partnerAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 26, fontWeight: 700 }}>泽</span>}
          </div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>{call?.status === 'active' ? `接通于 ${formatCallTime(call.started_at)}` : '点下面说一句，就会接通。挂断后会自动写一份摘要到聊天里。'}</div>
        </section>

        <div style={{ display: 'grid', gap: 10 }}>
          {transcript.map((item, index) => {
            const mine = item.role === 'me';
            return (
              <div key={`${item.createdAt || index}-${index}`} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '78%', padding: '10px 13px', borderRadius: mine ? '17px 17px 4px 17px' : '17px 17px 17px 4px', background: mine ? C.blush : C.white, border: `1px solid ${mine ? '#F5CABB' : C.border}`, color: C.text, fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {item.text}
                  <div style={{ marginTop: 4, fontSize: 9, color: C.mutedLight, textAlign: mine ? 'right' : 'left' }}>{formatCallTime(item.createdAt)}</div>
                </div>
              </div>
            );
          })}
          {thinking && <div style={{ color: C.muted, fontSize: 12, padding: '8px 2px' }}>陆泽在听你说完……</div>}
        </div>

        {summary && (
          <section style={{ marginTop: 16, padding: 12, borderRadius: 14, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, color: C.text, fontSize: 12, lineHeight: 1.7 }}>
            <strong style={{ display: 'block', color: C.honeyDeep, marginBottom: 4 }}>通话摘要已写回聊天</strong>
            {summary}
          </section>
        )}
      </main>

      <footer className="ourhome-safe-bottom" style={{ flexShrink: 0, background: 'rgba(255,255,255,.78)', borderTop: `1px solid ${C.border}`, padding: '10px 14px', backdropFilter: 'blur(14px)' }}>
        {error && <div role="alert" style={{ marginBottom: 8, padding: '7px 10px', borderRadius: 10, background: 'rgba(214,120,104,.1)', color: C.blushDeep, fontSize: 10.5, lineHeight: 1.5 }}>{error}</div>}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 22, padding: '6px 6px 6px 10px' }}>
          <button type="button" onClick={startSpeechInput} disabled={!speechSupported || listening || thinking || ending} aria-label="语音输入" title={speechSupported ? '语音输入' : '这台设备暂不支持语音输入'} style={{ width: 32, height: 32, borderRadius: '50%', border: 0, background: listening ? C.honey : 'transparent', color: listening ? C.white : C.muted, cursor: speechSupported && !thinking && !ending ? 'pointer' : 'default', fontSize: 15, flexShrink: 0 }}>🎙</button>
          <textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendTurn(); } }} placeholder="在电话里说……" rows={1} style={{ flex: 1, minHeight: 32, maxHeight: 96, resize: 'none', border: 0, outline: 'none', background: 'transparent', color: C.text, fontSize: 15, lineHeight: 1.6, fontFamily: 'inherit' }} />
          <button type="button" onClick={sendTurn} disabled={!draft.trim() || thinking || ending || calling} aria-label="发送通话内容" style={{ width: 36, height: 36, borderRadius: '50%', border: 0, cursor: draft.trim() && !thinking && !ending && !calling ? 'pointer' : 'default', background: draft.trim() && !thinking && !ending && !calling ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontSize: 15, flexShrink: 0 }}>{calling || thinking ? '…' : '↑'}</button>
        </div>
      </footer>
    </div>
  );
}
