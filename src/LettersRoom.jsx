import { useState } from 'react';
import { AgentMailRoom } from './AgentMailRoom.jsx';
import { apiFetch, BACKEND } from './api.js';

const PAPER_STYLES = {
  kraft: {
    label: "牛皮纸",
    swatch: "#C9A876",
    background: "radial-gradient(ellipse at 20% 30%, rgba(255,255,255,.08), transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(0,0,0,.06), transparent 60%), #CDAD7E",
    border: "1px solid #A6824F",
    color: "#3E2D14",
  },
  lined: {
    label: "横线本",
    swatch: "#FBF6E8",
    background: "repeating-linear-gradient(0deg, transparent 0px, transparent 27px, #BFD4E0 27px, #BFD4E0 28px), #FBF6E8",
    border: "1px solid #E3D9B8",
    color: "#3A3220",
    extraBorderLeft: "3px solid #E7A7A0",
  },
  floral: {
    label: "复古花边",
    swatch: "#FBEAE3",
    background: "linear-gradient(135deg, #FBEAE3 0%, #F7DCD2 100%)",
    border: "3px dashed #E8B79A",
    color: "#5A3424",
  },
  parchment: {
    label: "羊皮卷",
    swatch: "#E9D9AE",
    background: "radial-gradient(ellipse at center, #F1E4BE 0%, #DDC68C 75%, #C5AA68 100%)",
    border: "1px solid #B6995E",
    color: "#4A3815",
  },
};

const PAPER_STYLE_KEYS = Object.keys(PAPER_STYLES);

function MysteryBox({ x, y = 0, category, color, ribbon, mark = '', theme, onOpen }) {
  const [phase, setPhase] = useState('closed');
  const handleClick = () => {
    if (phase !== 'closed') return;
    setPhase('shake');
    setTimeout(() => setPhase('open'), 320);
    setTimeout(() => onOpen(category), 760);
  };
  const lidStyle = {
    transform: phase === 'open' ? 'translateY(-66px) rotate(-32deg)' : phase === 'shake' ? 'rotate(-4deg)' : 'rotate(0deg)',
    opacity: phase === 'open' ? 0 : 1,
    transformOrigin: '0px 90px',
    transition: phase === 'open' ? 'transform .42s cubic-bezier(.3,.6,.4,1), opacity .42s ease .15s' : 'transform .11s ease-in-out',
  };
  const bodyStyle = {
    transform: phase === 'shake' ? 'rotate(3deg)' : 'rotate(0deg)',
    transformOrigin: '0px 168px',
    transition: 'transform .11s ease-in-out',
  };
  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={handleClick}
      role="button"
      tabIndex="0"
      aria-label={`打开${category}`}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick();
        }
      }}
      style={{ cursor: phase === 'closed' ? 'pointer' : 'default', outline: 'none' }}
    >
      <ellipse cx="0" cy="172" rx="58" ry="9" fill="rgba(46,31,18,.12)" />
      {phase === 'open' && (
        <>
          <circle cx="0" cy="95" r="42" fill={theme.honeyLight} opacity="0.55" />
          {["✦", "✧", "✦", "✧", "✦"].map((s, i) => {
            const ang = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return <text key={i} x={Math.cos(ang) * 50} y={95 + Math.sin(ang) * 46} fontSize="14" fill={theme.honeyDeep} textAnchor="middle" opacity="0.9">{s}</text>;
          })}
        </>
      )}
      <rect x="-50" y="90" width="100" height="78" rx="10" fill={color} stroke={theme.honeyDeep} strokeWidth="2.5" style={bodyStyle} />
      <rect x="-50" y="122" width="100" height="12" fill="rgba(0,0,0,.08)" style={bodyStyle} />
      <rect x="-9" y="90" width="18" height="78" fill={ribbon} style={bodyStyle} />
      {mark && <text x="0" y="146" textAnchor="middle" fontSize="17" fill={theme.honeyDeep} fontFamily="inherit" style={bodyStyle}>{mark}</text>}
      <g style={lidStyle}>
        <rect x="-56" y="74" width="112" height="22" rx="7" fill={color} stroke={theme.honeyDeep} strokeWidth="2.5" />
        <rect x="-9" y="74" width="18" height="22" fill={ribbon} />
        <path d="M -9,74 Q -18,58 -9,46 Q -3,58 -9,74" fill={ribbon} />
        <path d="M 9,74 Q 18,58 9,46 Q 3,58 9,74" fill={ribbon} />
        <circle cx="0" cy="58" r="8" fill={ribbon} />
      </g>
      <text x="0" y="200" textAnchor="middle" fontSize="13.5" fontWeight="700" fill={theme.honeyDeep} fontFamily="inherit">{category}</text>
    </g>
  );
}

function CabinScene({ theme, onPick }) {
  return (
    <svg viewBox="0 0 360 420" style={{ width: "100%", maxWidth: 360 }} aria-label="时光信差的三个礼物盒">
      <text x="180" y="26" textAnchor="middle" fontSize="13" fontWeight="700" fill={theme.honeyDeep} fontFamily="inherit" letterSpacing="2">时光信差</text>
      <MysteryBox x={92} category="悄悄话" color={theme.blush} ribbon={theme.blushDeep} theme={theme} onOpen={onPick} />
      <MysteryBox x={268} category="幸福日记" color={theme.honeyLight} ribbon={theme.honey} theme={theme} onOpen={onPick} />
      <MysteryBox x={180} y={190} category="陆泽邮箱" color={theme.surface} ribbon={theme.honeyDeep} mark="✉" theme={theme} onOpen={onPick} />
    </svg>
  );
}

export function LettersRoom(props) {
  const {
    stage, view, C, lettersCategory, backToCabin, leaveRoom, openCategory,
    setView, openLetterId, setOpenLetterId, deleteLetter, letters, darkMode,
    diarySummariesByDate, repliesByParentId, replyingToId, replyText,
    setReplyText, setReplyingToId, submitReply, askAiWrite, aiWriting,
    whisperBgImage, whisperBgColor, lettersLoading, orderedRootLetters,
    revealedIds, toggleReveal, newLetterTitle, setNewLetterTitle,
    selectedPaperStyle, setSelectedPaperStyle, newLetterText, setNewLetterText,
    submitNewLetter, savingLetter, selectedModel,
  } = props;

  const getPaperStyle = key => {
    const base = PAPER_STYLES[key] || PAPER_STYLES.parchment;
    if (!darkMode) return base;
    return {
      ...base,
      background: `linear-gradient(145deg, ${C.white}, ${C.surface})`,
      border: `1px solid ${C.border}`,
      color: C.text,
      extraBorderLeft: base.extraBorderLeft ? `3px solid ${C.honeyMid}` : undefined,
    };
  };

  const shanghaiDateKey = value => {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
  };

  return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "letters") ? 1 : 0, pointerEvents: (stage === "home" && view === "letters") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span onClick={lettersCategory ? backToCabin : leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>{lettersCategory || "时光信差"}</span>
          {lettersCategory === '幸福日记' && (
            <small title={selectedModel || '当前 Chat 模型'} aria-label={`幸福日记跟随 Chat 模型：${selectedModel || '当前选择'}`} style={{ marginLeft: 'auto', maxWidth: 126, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '4px 8px', borderRadius: 999, color: C.honeyDeep, background: C.honeyLight, fontSize: 9.5, letterSpacing: '.04em' }}>
              跟随 Chat 模型
            </small>
          )}
        </header>

        {!lettersCategory ? (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 20px 24px" }}>
            <CabinScene theme={C} onPick={openCategory} />
            <div style={{ maxWidth: 330, fontSize: 10.5, lineHeight: 1.75, color: C.muted, letterSpacing: ".09em", textAlign: "center" }}>把悄悄话、幸福日记和寄往世界的小信，都藏进各自的礼物盒里。</div>
          </div>
        ) : lettersCategory === '陆泽邮箱' ? (
          <AgentMailRoom
            apiFetch={apiFetch}
            backend={BACKEND}
            theme={C}
            onOpenSettings={() => setView('settings')}
          />
        ) : (lettersCategory === '幸福日记' && openLetterId) ? (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span onClick={() => setOpenLetterId(null)} style={{ fontSize: 12, color: C.honeyDeep, cursor: "pointer" }}>← 返回</span>
                <span onClick={() => deleteLetter(openLetterId)} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer" }}>删除</span>
              </div>
              {(() => {
                const l = letters.find(x => x.id === openLetterId);
                if (!l) return null;
                const style = getPaperStyle(l.paper_style);
                const diaryDateKey = shanghaiDateKey(l.created_at);
                const diarySummary = diarySummariesByDate[diaryDateKey];
                return (
                  <>
                    <div style={{ marginTop: 14, marginBottom: 10, padding: "11px 13px", color: C.honeyDeep, background: `linear-gradient(145deg, ${C.honeyLight}, ${C.white})`, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: `0 5px 14px ${C.borderLight}88` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 10, letterSpacing: ".15em", fontWeight: 700 }}>今日摘要</span>
                        <span style={{ color: C.mutedLight, fontSize: 9.5 }}>{diaryDateKey}</span>
                      </div>
                      <p style={{ margin: 0, color: C.muted, fontSize: 11.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{diarySummary?.summary || "这一天的摘要还没有生成。"}</p>
                    </div>
                    <div style={{ background: style.background, border: style.border, borderLeft: style.extraBorderLeft || style.border, borderRadius: 10, padding: "22px 22px", color: style.color, boxShadow: "0 6px 18px rgba(46,31,18,.18)" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l.title || "（没有标题）"}</div>
                      <div style={{ fontSize: 10.5, opacity: .65, marginBottom: 16, letterSpacing: ".05em" }}>{l.author} · {l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                      <div style={{ fontSize: 14.5, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{l.content}</div>
                      {(repliesByParentId.get(l.id) || []).map(r => (
                        <div key={r.id} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid rgba(0,0,0,.12)` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{r.author}</div>
                          <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.content}</div>
                        </div>
                      ))}
                      {replyingToId === l.id ? (
                        <div style={{ marginTop: 12 }}>
                          <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} style={{ width: "100%", fontSize: 13, color: C.text, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                            <span onClick={() => { setReplyingToId(null); setReplyText(""); }} style={{ fontSize: 11, cursor: "pointer", padding: "3px 8px", opacity: .7 }}>取消</span>
                            <span onClick={() => submitReply(l.id)} style={{ fontSize: 11, color: C.white, cursor: "pointer", padding: "3px 10px", background: C.honey, borderRadius: 999 }}>留言</span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                          <span onClick={() => setReplyingToId(l.id)} style={{ fontSize: 11, cursor: "pointer", opacity: .75 }}>{l.author === '泽' ? '叶檀留言' : '回信'}</span>
                          {l.author !== '泽' && (
                            <span onClick={() => askAiWrite(l.id)} style={{ fontSize: 11, cursor: "pointer", opacity: .9, fontWeight: 600 }}>{aiWriting === l.id ? "陆泽在写…" : "请陆泽回信"}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        ) : (
          <>
            <div style={{
              flex: 1, overflowY: "auto", padding: "16px 14px",
              background: lettersCategory === '悄悄话'
                ? (whisperBgImage ? `url(${whisperBgImage}) center/cover no-repeat` : (whisperBgColor || "#3A2C1E"))
                : "transparent"
            }}>
              {lettersLoading && (
                <div style={{ textAlign: "center", fontSize: 12, color: lettersCategory === '悄悄话' ? "#C9B08C" : C.muted, padding: "20px 0" }}>翻找中…</div>
              )}
              {!lettersLoading && orderedRootLetters.length === 0 && (
                <div style={{ textAlign: "center", fontSize: 12, color: lettersCategory === '悄悄话' ? "#C9B08C" : C.muted, padding: "20px 0" }}>这里还没有信，写第一篇吧。</div>
              )}
              {!lettersLoading && lettersCategory === '幸福日记' && orderedRootLetters.map(l => {
                const style = getPaperStyle(l.paper_style);
                return (
                  <div key={l.id} onClick={() => setOpenLetterId(l.id)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: style.swatch, flexShrink: 0, border: "1px solid rgba(0,0,0,.15)" }} />
                    <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: C.white, background: l.author === '泽' ? `linear-gradient(150deg, #E8B45A, ${C.honeyDeep})` : `linear-gradient(150deg, #F2AFA2, ${C.blushDeep})` }}>{l.author}</span>
                    <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title || "（没有标题）"}</span>
                    <span style={{ fontSize: 10.5, color: C.mutedLight, flexShrink: 0 }}>{l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' }) : ''}</span>
                  </div>
                );
              })}
              {!lettersLoading && lettersCategory === '悄悄话' && orderedRootLetters.map(l => {
                const revealed = revealedIds.has(l.id);
                return (
                  <div key={l.id} style={{ marginBottom: 16, background: darkMode ? C.white : "rgba(255,248,236,.94)", border: `1px solid ${darkMode ? C.border : "#D9C19A"}`, borderRadius: 14, padding: "12px 14px", boxShadow: "0 4px 10px rgba(0,0,0,.25)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.honeyDeep }}>{l.author}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9.5, color: C.mutedLight }}>{l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        {revealed && <span onClick={() => deleteLetter(l.id)} style={{ fontSize: 10.5, color: "#A78A5E", cursor: "pointer" }}>删除</span>}
                      </div>
                    </div>
                    {!revealed ? (
                      <div onClick={() => toggleReveal(l.id)} style={{ fontSize: 13, color: darkMode ? C.mutedLight : "#A78A5E", cursor: "pointer", padding: "10px 0", textAlign: "center", letterSpacing: ".1em", border: `1px dashed ${darkMode ? C.borderLight : "#D9C19A"}`, borderRadius: 8 }}>🔒 轻触查看悄悄话</div>
                    ) : (
                      <div onClick={() => toggleReveal(l.id)} style={{ fontSize: 14, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap", cursor: "pointer" }}>{l.content}</div>
                    )}
                    {revealed && (repliesByParentId.get(l.id) || []).map(r => (
                      <div key={r.id} style={{ marginTop: 10, marginLeft: 14, paddingLeft: 10, borderLeft: `2px solid ${C.borderLight}` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.honeyDeep, marginBottom: 2 }}>{r.author}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }}>{r.content}</div>
                      </div>
                    ))}
                    {revealed && (replyingToId === l.id ? (
                      <div style={{ marginTop: 10 }}>
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} style={{ width: "100%", fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                          <span onClick={() => { setReplyingToId(null); setReplyText(""); }} style={{ fontSize: 11, color: C.muted, cursor: "pointer", padding: "3px 8px" }}>取消</span>
                          <span onClick={() => submitReply(l.id)} style={{ fontSize: 11, color: C.white, cursor: "pointer", padding: "3px 10px", background: C.honey, borderRadius: 999 }}>留言</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                        <span onClick={() => setReplyingToId(l.id)} style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>{l.author === '泽' ? '叶檀留言' : '回信'}</span>
                        {l.author !== '泽' && (
                          <span onClick={() => askAiWrite(l.id)} style={{ fontSize: 11, color: C.honeyDeep, cursor: "pointer" }}>{aiWriting === l.id ? "陆泽在写…" : "请陆泽回信"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="ourhome-safe-bottom" style={{ background: C.white, borderTop: `1px solid ${C.border}`, paddingTop: 10, paddingLeft: 14, paddingRight: 14, flexShrink: 0 }}>
              {lettersCategory === '幸福日记' && (
                <>
                  <input value={newLetterTitle} onChange={e => setNewLetterTitle(e.target.value)} placeholder="今天的日记起个标题…" style={{ width: "100%", fontSize: 13.5, color: C.text, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 999, padding: "8px 14px", outline: "none", marginBottom: 8, fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    {PAPER_STYLE_KEYS.map(key => (
                      <div key={key} onClick={() => setSelectedPaperStyle(key)} title={PAPER_STYLES[key].label} style={{ width: 26, height: 26, borderRadius: 8, background: PAPER_STYLES[key].swatch, cursor: "pointer", border: selectedPaperStyle === key ? `2px solid ${C.honeyDeep}` : `1px solid ${C.border}`, boxShadow: selectedPaperStyle === key ? `0 0 0 2px ${C.honeyLight}` : "none" }} />
                    ))}
                  </div>
                </>
              )}
              <textarea value={newLetterText} onChange={e => setNewLetterText(e.target.value)} placeholder={lettersCategory === '悄悄话' ? "悄悄说一句…" : `在"${lettersCategory}"写一篇新的…`} rows={2} style={{ width: "100%", fontSize: 14, color: C.text, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 10, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <span onClick={() => askAiWrite(null)} style={{ fontSize: 12, color: C.honeyDeep, cursor: "pointer" }}>{aiWriting === 'new' ? "陆泽在写…" : "✦ 请陆泽写一篇"}</span>
                <span onClick={submitNewLetter} style={{ fontSize: 12.5, color: C.white, cursor: "pointer", padding: "6px 16px", background: newLetterText.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>{savingLetter ? "存中…" : "寄出"}</span>
              </div>
            </div>
          </>
        )}
      </div>
  );
}
