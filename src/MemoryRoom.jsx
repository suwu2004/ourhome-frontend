import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { SettingsGroup } from './SettingsGroup.jsx';
import { apiFetch, BACKEND } from './api.js';
import './MemoryRoom.css';

const TheaterRuleLibrary = lazy(() => import('./TheaterRuleLibrary.jsx'));
const WorldbookLibrary = lazy(() => import('./WorldbookLibrary.jsx'));

const MEMORY_LAYER_TABS = [
  { key: 'core', label: '核心记忆', description: '稳定身份、偏好、边界和重要约定' },
  { key: 'episodic', label: '阶段记忆', description: '重要经历、关系片段和项目进展' },
  { key: 'temporary', label: '临时记忆', description: '近期没聊完、还需要接上的事情' },
];

const MEMORY_KIND_LABELS = {
  identity: '身份',
  preference: '偏好',
  boundary: '边界',
  relationship: '关系',
  plan: '计划',
  state: '近况',
  health: '身体',
  project: '项目',
  event: '经历',
  general: '记忆',
};

function displayDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LayerTab({ tab, active, count, onClick, theme }) {
  return (
    <button
      type="button"
      className="memory-layer-tab"
      role="tab"
      onClick={onClick}
      aria-selected={active}
      style={{
        padding: '9px 8px',
        border: `1px solid ${active ? theme.honey : theme.border}`,
        borderRadius: 12,
        background: active ? theme.honeyLight : theme.white,
        color: active ? theme.honeyDeep : theme.muted,
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'center',
      }}
    >
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700 }}>{tab.label}</span>
      <span style={{ display: 'block', marginTop: 3, fontSize: 9.5, lineHeight: 1.2, color: active ? theme.honeyDeep : theme.mutedLight }}>{count} 条</span>
    </button>
  );
}

export function MemoryRoom({
  theme: C,
  visible,
  leaveRoom,
  resetKey,
  systemPromptInput,
  setSystemPromptInput,
  temperatureInput,
  setTemperatureInput,
  minReplyCharsInput,
  setMinReplyCharsInput,
  savePersona,
  savingPersona,
  newMemory,
  setNewMemory,
  saveMemory,
  savingMemory,
  memoriesLoading,
  memories,
  editingMemoryId,
  editingMemoryText,
  setEditingMemoryText,
  startEditMemory,
  cancelEditMemory,
  saveEditMemory,
  deleteMemory,
}) {
  const [memoryLayer, setMemoryLayer] = useState('core');
  const [workingMemories, setWorkingMemories] = useState([]);
  const [workingLoading, setWorkingLoading] = useState(false);
  const [workingError, setWorkingError] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setWorkingLoading(true);
    setWorkingError('');
    apiFetch(`${BACKEND}/memory-log?days=90`)
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || '临时记忆没有打开');
        if (!cancelled) setWorkingMemories(Array.isArray(payload?.openMarks) ? payload.openMarks : []);
      })
      .catch(error => {
        if (!cancelled) setWorkingError(error.message || '临时记忆没有打开');
      })
      .finally(() => {
        if (!cancelled) setWorkingLoading(false);
      });
    return () => { cancelled = true; };
  }, [visible]);

  const coreMemories = useMemo(
    () => memories.filter(memory => memory.memory_tier === 'core' || memory.is_protected),
    [memories],
  );
  const episodicMemories = useMemo(
    () => memories.filter(memory => memory.memory_tier !== 'core' && !memory.is_protected && memory.memory_tier !== 'archived'),
    [memories],
  );
  const activeWorkingMemories = useMemo(
    () => workingMemories.filter(memory => !memory.expires_at || Date.parse(memory.expires_at) > Date.now()),
    [workingMemories],
  );

  const selectedPersistentMemories = memoryLayer === 'core' ? coreMemories : episodicMemories;
  const selectedTab = MEMORY_LAYER_TABS.find(tab => tab.key === memoryLayer) || MEMORY_LAYER_TABS[0];
  const layerCounts = {
    core: coreMemories.length,
    episodic: episodicMemories.length,
    temporary: activeWorkingMemories.length,
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
      <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
        <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>✦ 陆泽的大脑</span>
      </header>
      <div className="ourhome-scroll memory-room-scroll" style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
        <SettingsGroup theme={C} title="人设" subtitle="陆泽的核心设定与回复随机性" resetKey={resetKey}>
          <textarea value={systemPromptInput} onChange={e => setSystemPromptInput(e.target.value)} rows={8} placeholder="陆泽的人设设定…" style={{ width: "100%", fontSize: 12.5, lineHeight: 1.6, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", outline: "none", marginBottom: 8, resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0 }}>随机性 {temperatureInput}</span>
            <input type="range" min="0" max="1" step="0.1" value={temperatureInput} onChange={e => setTemperatureInput(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
              <span style={{ fontSize: 11.5, color: C.muted }}>最低回复长度</span>
              <label style={{ display: "flex", alignItems: "center", gap: 4, color: C.mutedLight, fontSize: 10.5 }}>
                <input
                  type="number"
                  min="0"
                  max="600"
                  step="10"
                  value={minReplyCharsInput}
                  onChange={e => setMinReplyCharsInput(Math.min(600, Math.max(0, Number(e.target.value) || 0)))}
                  style={{ width: 62, border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.text, padding: "4px 6px", fontFamily: "inherit", textAlign: "right" }}
                />
                字
              </label>
            </div>
            <input aria-label="陆泽最低回复长度" type="range" min="0" max="600" step="10" value={minReplyCharsInput} onChange={e => setMinReplyCharsInput(Number(e.target.value))} style={{ width: "100%" }} />
            <div style={{ fontSize: 10.5, lineHeight: 1.55, color: C.mutedLight }}>陆泽仍会自己判断该说多长；不足下限时只把当前内容说完整，不会另起无关话题。设为 0 就只按语境决定。</div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <span onClick={savePersona} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "5px 14px", background: systemPromptInput.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>{savingPersona ? "存中…" : "保存人设"}</span>
          </div>
        </SettingsGroup>

        <SettingsGroup theme={C} title="规则与世界" subtitle="写法归规则，背景进世界书" resetKey={resetKey} mountOnOpen>
          <div className="memory-knowledge-grid">
            {visible && (
              <Suspense fallback={<div style={{ gridColumn: '1 / -1', padding: '16px 0', textAlign: 'center', color: C.muted, fontSize: 11 }}>正在整理规则与世界书…</div>}>
                <TheaterRuleLibrary />
                <WorldbookLibrary />
              </Suspense>
            )}
          </div>
        </SettingsGroup>

        <SettingsGroup theme={C} title="主动记忆" subtitle="你亲手交给陆泽记住的内容" resetKey={resetKey}>
          <div className="memory-active-form">
            <input value={newMemory} onChange={e => setNewMemory(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveMemory(); }} placeholder="记下点什么…" style={{ flex: 1, fontSize: 13, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 14px", outline: "none" }} />
            <button onClick={saveMemory} disabled={!newMemory.trim() || savingMemory} style={{ fontSize: 12, color: C.white, background: newMemory.trim() ? C.honey : C.honeyMid, border: "none", borderRadius: 999, padding: "0 16px", cursor: newMemory.trim() ? "pointer" : "default", letterSpacing: ".05em" }}>{savingMemory ? "存中…" : "记住"}</button>
          </div>
          <p className="memory-active-note">这类内容会先进入阶段记忆，后续再根据重要程度沉淀；原文始终可以在这里查看和修改。</p>
        </SettingsGroup>

        <SettingsGroup theme={C} title="记忆总览" subtitle="核心、阶段和临时记忆放在同一个框里" resetKey={resetKey}>
          <div className="memory-layer-intro" style={{ background: C.honeyLight, borderColor: C.honeyMid, color: C.honeyDeep }}>
            记忆会在三个层级间自然流动，稳定身份和重要约定沉淀为核心，真实经历与项目进展留在阶段，近期没聊完的事情暂存在临时层。归档只退出当前上下文，不会悄悄删除原内容。
          </div>
          <div className="memory-layer-tabs" role="tablist" aria-label="记忆层级">
            {MEMORY_LAYER_TABS.map(tab => (
              <LayerTab
                key={tab.key}
                tab={tab}
                count={layerCounts[tab.key]}
                active={memoryLayer === tab.key}
                onClick={() => setMemoryLayer(tab.key)}
                theme={C}
              />
            ))}
          </div>
          <div className="memory-selected-layer" style={{ borderColor: C.borderLight }}>
            <strong style={{ color: C.text }}>{selectedTab.label}</strong>
            <span style={{ color: C.muted }}>{selectedTab.description}</span>
          </div>
          {memoryLayer === 'temporary' ? (
            <>
              {workingLoading && <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, padding: '20px 0' }}>整理近期话题中…</div>}
              {!workingLoading && workingError && <div style={{ fontSize: 11.5, lineHeight: 1.6, color: C.blushDeep, padding: '10px 0' }}>{workingError}</div>}
              {!workingLoading && !workingError && activeWorkingMemories.length === 0 && (
                <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, letterSpacing: '.08em', padding: '20px 0' }}>现在没有挂着没聊完的事情。</div>
              )}
              {!workingLoading && !workingError && activeWorkingMemories.map((memory, idx) => (
                <div key={memory.id ?? idx} style={{ marginBottom: 13, paddingBottom: 13, borderBottom: idx === activeWorkingMemories.length - 1 ? 'none' : `1px solid ${C.borderLight}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.honeyDeep }}>{memory.topic || '近期话题'}</span>
                    <span style={{ fontSize: 9.5, color: C.mutedLight, flexShrink: 0 }}>{displayDate(memory.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.7, color: C.text, whiteSpace: 'pre-wrap' }}>{memory.summary}</div>
                  <div style={{ marginTop: 6, fontSize: 9.5, color: C.mutedLight }}>会在话题结束、被新进展替代或到期后自然归档。</div>
                </div>
              ))}
            </>
          ) : (
            <>
              {memoriesLoading && (
                <div style={{ textAlign: "center", fontSize: 12, color: C.muted, letterSpacing: ".1em", padding: "20px 0" }}>翻找中…</div>
              )}
              {!memoriesLoading && selectedPersistentMemories.length === 0 && (
                <div style={{ textAlign: "center", fontSize: 12, color: C.muted, letterSpacing: ".08em", padding: "20px 0" }}>{memoryLayer === 'core' ? '还没有被提炼成核心的记忆。' : '还没有存下来的阶段记忆。'}</div>
              )}
              {!memoriesLoading && selectedPersistentMemories.map((memory, idx) => (
                <div key={memory.id ?? idx} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: idx === selectedPersistentMemories.length - 1 ? "none" : `1px solid ${C.borderLight}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, marginBottom: 5 }}>
                      <span style={{ flexShrink: 0, fontSize: 9.5, color: memoryLayer === 'core' ? C.honeyDeep : C.muted, background: memoryLayer === 'core' ? C.honeyLight : C.cream, border: `1px solid ${memoryLayer === 'core' ? C.honeyMid : C.border}`, borderRadius: 999, padding: '2px 7px' }}>{MEMORY_KIND_LABELS[memory.memory_kind] || '记忆'}</span>
                      {memory.timestamp && <span style={{ fontSize: 9.5, color: C.mutedLight }}>{displayDate(memory.timestamp)}</span>}
                    </div>
                    {editingMemoryId !== memory.id && (
                      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                        <span onClick={() => startEditMemory(memory)} style={{ fontSize: 11, color: C.honeyDeep, cursor: "pointer" }}>编辑</span>
                        <span onClick={() => deleteMemory(memory.id)} style={{ fontSize: 11, color: C.blushDeep, cursor: "pointer" }}>删除</span>
                      </div>
                    )}
                  </div>
                  {editingMemoryId === memory.id ? (
                    <div>
                      <textarea value={editingMemoryText} onChange={e => setEditingMemoryText(e.target.value)} rows={3} style={{ width: "100%", fontSize: 13.5, lineHeight: 1.6, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                        <span onClick={cancelEditMemory} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", padding: "4px 8px" }}>取消</span>
                        <span onClick={saveEditMemory} style={{ fontSize: 11.5, color: C.white, cursor: "pointer", padding: "4px 10px", background: C.honey, borderRadius: 999 }}>保存</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13.5, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap" }}>{memory.summary}</div>
                  )}
                  {memoryLayer === 'core' && memory.reinforcement_count > 0 && (
                    <div style={{ marginTop: 6, fontSize: 9.5, color: C.mutedLight }}>已在相关对话中被重新想起 {memory.reinforcement_count} 次</div>
                  )}
                </div>
              ))}
            </>
          )}
        </SettingsGroup>
      </div>
    </div>
  );
}
