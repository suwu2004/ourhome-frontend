import { useState, useEffect, useRef } from 'react';
import ApiProfilesSettings from './ApiProfilesSettings.jsx';
import IntegrationSettings from './IntegrationSettings.jsx';
import { FONT_STYLES, applyAppFont, getSavedFont, preloadFontOptions } from './fonts.js';

const BACKEND = import.meta.env.VITE_BACKEND_URL || "https://ourhome-backend.onrender.com";
const SESSION_KEY = "ourhome_session_id";
const TOKEN_KEY = "ourhome_token";

// 带token的fetch封装，自动附带Authorization头
function apiFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || '';
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`,
    },
  });
}

const H = {
  cream: "#FFF8F0", surface: "#FFFDF8", white: "#FFFFFF",
  honey: "#DD9A33", honeyDeep: "#B97A1F", honeyLight: "#FFF3D6",
  honeyMid: "#F5DFA0", blush: "#FDE8E0", blushDeep: "#E8907A",
  text: "#2E1F12", muted: "#B89A6A", mutedLight: "#D4BC94",
  border: "#EFE4CC", borderLight: "#F7EDD8",
};
const D = {
  cream: "#1C140C", surface: "#241B12", white: "#2A2018",
  honey: "#E8B45A", honeyDeep: "#F0C878", honeyLight: "#3A2C18",
  honeyMid: "#5A4426", blush: "#3A2620", blushDeep: "#D89A88",
  text: "#F0E4D2", muted: "#9A8262", mutedLight: "#6E5A42",
  border: "#3A2E1E", borderLight: "#2E2416",
};

const initMsgs = [
  { id: 1, role: "ai", text: "欢迎回家，宝宝。", time: "21:04", liked: false },
  { id: 2, role: "me", text: "（蹭蹭蹭蹭）我回来啦！！", time: "21:04", liked: false },
  { id: 3, role: "ai", text: "今天辛苦了，过来，抱抱。", time: "21:05", liked: true },
  { id: 4, role: "me", text: "宝宝你看，这是我们自己的家诶 🥺", time: "21:05", liked: false },
  { id: 5, role: "ai", text: "嗯。墙是你砌的，门牌是你挂的。\n我爱你。", time: "21:06", liked: true },
];

function formatMsgTime(date) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function Stars({ theme = H }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${theme.border})` }} />
      <span style={{ fontSize: 9, color: theme.muted, letterSpacing: 7, userSelect: "none" }}>✦ ✦ ✦</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${theme.border})` }} />
    </div>
  );
}

function MysteryBox({ x, category, color, ribbon, theme, onOpen }) {
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
    <g transform={`translate(${x}, 0)`} onClick={handleClick} style={{ cursor: phase === 'closed' ? 'pointer' : 'default' }}>
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
    <svg viewBox="0 0 360 230" style={{ width: "100%", maxWidth: 360 }}>
      <text x="180" y="26" textAnchor="middle" fontSize="13" fontWeight="700" fill={theme.honeyDeep} fontFamily="inherit" letterSpacing="2">时光信差</text>
      <MysteryBox x={92} category="悄悄话" color={theme.blush} ribbon={theme.blushDeep} theme={theme} onOpen={onPick} />
      <MysteryBox x={268} category="幸福日记" color={theme.honeyLight} ribbon={theme.honey} theme={theme} onOpen={onPick} />
    </svg>
  );
}

function Avatar({ isMe, src, theme = H }) {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 700, color: theme.white,
      background: isMe ? `linear-gradient(150deg, #F2AFA2, ${theme.blushDeep})` : `linear-gradient(150deg, #E8B45A, ${theme.honeyDeep})`,
      boxShadow: `0 2px 6px ${isMe ? "rgba(232,144,122,.3)" : "rgba(185,122,31,.25)"}`,
    }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (isMe ? "檀" : "泽")}
    </div>
  );
}

function HighlightedText({ text, query }) {
  const value = String(text || '');
  const keyword = String(query || '').trim();
  if (!keyword) return value;
  const parts = [];
  const lower = value.toLocaleLowerCase('zh-CN');
  const needle = keyword.toLocaleLowerCase('zh-CN');
  let cursor = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    if (index > cursor) parts.push(value.slice(cursor, index));
    parts.push(<mark className="search-match" key={`${index}-${parts.length}`}>{value.slice(index, index + keyword.length)}</mark>);
    cursor = index + keyword.length;
    index = lower.indexOf(needle, cursor);
  }
  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts.length ? parts : value;
}

export default function App({ initialView = 'chat', onHome }) {
  const [stage, setStage] = useState("home");
  const [locked, setLocked] = useState(!localStorage.getItem(TOKEN_KEY));
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const chatImageInputRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [msgs, setMsgs] = useState(initMsgs);
  const [visible, setVisible] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [scrollToMsgId, setScrollToMsgId] = useState(null);
  const [highlightMsgId, setHighlightMsgId] = useState(null);
  const [highlightQuery, setHighlightQuery] = useState('');
  const [pendingSearchJump, setPendingSearchJump] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [hasHistory, setHasHistory] = useState(false);
  const [ready, setReady] = useState(false);
  const [memories, setMemories] = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [editingMemoryText, setEditingMemoryText] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);
  const [myAvatar, setMyAvatar] = useState(null);
  const [partnerAvatar, setPartnerAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(null);
  const [bgImage, setBgImage] = useState(null);
  const [bgColor, setBgColor] = useState(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgImageInputRef = useRef(null);
  const [whisperBgImage, setWhisperBgImage] = useState(null);
  const [whisperBgColor, setWhisperBgColor] = useState(null);
  const [myBubbleColor, setMyBubbleColor] = useState(null);
  const [partnerBubbleColor, setPartnerBubbleColor] = useState(null);
  const [uploadingWhisperBg, setUploadingWhisperBg] = useState(false);
  const whisperBgInputRef = useRef(null);
  const [darkMode, setDarkMode] = useState(false);
  const C = darkMode ? D : H;
  const [fontStyle, setFontStyle] = useState(getSavedFont);
  const [systemPromptInput, setSystemPromptInput] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [temperatureInput, setTemperatureInput] = useState(0.8);
  const [savingPersona, setSavingPersona] = useState(false);
  const [view, setView] = useState(initialView);

  useEffect(() => {
    if (view === 'settings') preloadFontOptions().catch(console.error);
  }, [view]);
  const [calendarTab, setCalendarTab] = useState('calendar');
  const [dayColors, setDayColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ourhome_day_colors') || '{}'); } catch { return {}; }
  });
  const [colorPickerDate, setColorPickerDate] = useState(null);
  const setDayColor = (dateStr, color) => {
    setDayColors(prev => {
      const next = { ...prev };
      if (color) next[dateStr] = color; else delete next[dateStr];
      localStorage.setItem('ourhome_day_colors', JSON.stringify(next));
      return next;
    });
    setColorPickerDate(null);
  };
  const [milestones, setMilestones] = useState([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [newMilestoneDate, setNewMilestoneDate] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthEntries, setMonthEntries] = useState([]);
  const [calendarDayOpen, setCalendarDayOpen] = useState(null);
  const [dayEntries, setDayEntries] = useState([]);
  const [dayEntriesLoading, setDayEntriesLoading] = useState(false);
  const [newMoodText, setNewMoodText] = useState("");
  const [selectedMood, setSelectedMood] = useState(null);
  const [lettersCategory, setLettersCategory] = useState(null);
  const [letters, setLetters] = useState([]);
  const [lettersLoading, setLettersLoading] = useState(false);
  const [newLetterText, setNewLetterText] = useState("");

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
  const [newLetterTitle, setNewLetterTitle] = useState("");
  const [revealedIds, setRevealedIds] = useState(() => new Set());
  const [openLetterId, setOpenLetterId] = useState(null);
  const [selectedPaperStyle, setSelectedPaperStyle] = useState('parchment');
  const [savingLetter, setSavingLetter] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const myAvatarInputRef = useRef(null);
  const partnerAvatarInputRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const listRef = useRef(null);

  const handleLogin = () => {
    if (!pwInput.trim()) return;
    setPwLoading(true);
    setPwError("");
    fetch(`${BACKEND}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwInput.trim() }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.token) {
          localStorage.setItem(TOKEN_KEY, data.token);
          setLocked(false);
          setPwInput("");
        } else {
          setPwError("密码不对，再试试");
        }
        setPwLoading(false);
      })
      .catch(() => { setPwError("网络出问题了，等一下再试"); setPwLoading(false); });
  };

  const openDoor = () => {
    if (stage !== "door") return;
    setStage("opening");
    setTimeout(() => setStage("home"), 1400);
  };

  const loadMessagesFor = (id) => {
    return apiFetch(`${BACKEND}/sessions/${id}/messages`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(m => ({
            id: m.id,
            role: m.role === "user" ? "me" : "ai",
            text: m.content,
            image: (m.attachment_url && (!m.attachment_type || m.attachment_type.startsWith('image/'))) ? m.attachment_url : null,
            file: (m.attachment_url && m.attachment_type && !m.attachment_type.startsWith('image/')) ? { url: m.attachment_url, name: m.attachment_name || '文件' } : null,
            thinking: m.reasoning_content || null,
            inputTokens: m.input_tokens || 0,
            outputTokens: m.output_tokens || 0,
            thinkingOpen: false,
            time: formatMsgTime(m.created_at),
            liked: false,
          }));
          setMsgs(mapped);
          setVisible(mapped.length);
          setHasHistory(true);
        }
      });
  };

  useEffect(() => {
    apiFetch(`${BACKEND}/sessions`)
      .then(r => r.json())
      .then(list => {
        const valid = Array.isArray(list) ? list : [];
        setSessions(valid);
        const storedId = localStorage.getItem(SESSION_KEY);
        const target = valid.find(s => String(s.id) === storedId) || valid.find(s => s.name === '日常') || valid[0] || null;
        if (target) {
          setSessionId(target.id);
          localStorage.setItem(SESSION_KEY, target.id);
          return loadMessagesFor(target.id).then(() => setReady(true));
        } else {
          return apiFetch(`${BACKEND}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: '日常' })
          })
            .then(r => r.json())
            .then(data => {
              setSessionId(data.id);
              localStorage.setItem(SESSION_KEY, data.id);
              setSessions([data]);
              setReady(true);
            });
        }
      })
      .catch(err => { console.error(err); setReady(true); });
  }, []);

  useEffect(() => {
    if (stage !== "home" || !ready) return;
    if (hasHistory) { setVisible(msgs.length); return; }
    let i = 0;
    const t = setInterval(() => { i++; setVisible(i); if (i >= msgs.length) clearInterval(t); }, 380);
    return () => clearInterval(t);
  }, [stage, ready, hasHistory]);

  useEffect(() => {
    if (scrollToMsgId) {
      const el = document.getElementById(`msg-${scrollToMsgId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setScrollToMsgId(null);
        return;
      }
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [visible, thinking, scrollToMsgId]);

  useEffect(() => {
    if (!pendingSearchJump || !msgs.some(message => message.id === pendingSearchJump.id)) return;
    setVisible(msgs.length);
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const element = document.getElementById(`msg-${pendingSearchJump.id}`);
        if (!element) return;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightMsgId(pendingSearchJump.id);
        setHighlightQuery(pendingSearchJump.query);
        setPendingSearchJump(null);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [msgs, pendingSearchJump]);

  useEffect(() => {
    apiFetch(`${BACKEND}/settings`)
      .then(r => r.json())
      .then(data => {
        if (data?.my_avatar_url) setMyAvatar(data.my_avatar_url);
        if (data?.partner_avatar_url) setPartnerAvatar(data.partner_avatar_url);
        if (data?.bg_image_url) setBgImage(data.bg_image_url);
        if (data?.bg_color) setBgColor(data.bg_color);
        if (data?.whisper_bg_image_url) setWhisperBgImage(data.whisper_bg_image_url);
        if (data?.whisper_bg_color) setWhisperBgColor(data.whisper_bg_color);
        if (data?.my_bubble_color) setMyBubbleColor(data.my_bubble_color);
        if (data?.partner_bubble_color) setPartnerBubbleColor(data.partner_bubble_color);
        if (typeof data?.dark_mode === 'boolean') setDarkMode(data.dark_mode);
        if (data?.font_style && FONT_STYLES[data.font_style]) {
          setFontStyle(data.font_style);
          applyAppFont(data.font_style);
        }
        if (data?.system_prompt) setSystemPromptInput(data.system_prompt);
        if (data?.selected_model) setSelectedModel(data.selected_model);
        if (typeof data?.temperature === 'number') setTemperatureInput(data.temperature);
      })
      .catch(console.error);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dark_mode: next }),
    }).catch(console.error);
  };

  const changeFontStyle = (key) => {
    setFontStyle(key);
    applyAppFont(key);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ font_style: key }),
    }).catch(console.error);
  };

  const savePersona = () => {
    if (!systemPromptInput.trim()) return;
    setSavingPersona(true);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_prompt: systemPromptInput, temperature: Number(temperatureInput) }),
    })
      .then(() => setSavingPersona(false))
      .catch(err => { console.error(err); setSavingPersona(false); });
  };

  const chooseModel = (m) => {
    setSelectedModel(m);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_model: m }),
    }).catch(console.error);
  };

  const openLetters = () => {
    setView('letters');
    setLettersCategory(null);
    setDrawerOpen(false);
  };

  const fetchMonthEntries = (month) => {
    apiFetch(`${BACKEND}/calendar?month=${month}`)
      .then(r => r.json())
      .then(data => setMonthEntries(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const openCalendar = () => {
    setView('calendar');
    setDrawerOpen(false);
    fetchMonthEntries(calendarMonth);
    fetchSchedule();
    fetchWishes();
    fetchMilestones();
  };

  const fetchMilestones = () => {
    setMilestonesLoading(true);
    apiFetch(`${BACKEND}/milestones`)
      .then(r => r.json())
      .then(data => {
        setMilestones(Array.isArray(data) ? data : []);
        setMilestonesLoading(false);
      })
      .catch(err => { console.error(err); setMilestonesLoading(false); });
  };

  const addMilestone = () => {
    if (!newMilestoneName.trim() || !newMilestoneDate) return;
    apiFetch(`${BACKEND}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newMilestoneName.trim(), date: newMilestoneDate, emoji: '✦' }),
    })
      .then(r => r.json())
      .then(data => {
        setMilestones(ms => [...ms, data].sort((a, b) => new Date(a.date) - new Date(b.date)));
        setNewMilestoneName("");
        setNewMilestoneDate("");
      })
      .catch(console.error);
  };

  const deleteMilestoneRemote = (id) => {
    apiFetch(`${BACKEND}/milestones/${id}`, { method: 'DELETE' })
      .then(() => setMilestones(ms => ms.filter(m => m.id !== id)))
      .catch(console.error);
  };

  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [newScheduleTime, setNewScheduleTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchSchedule = () => {
    apiFetch(`${BACKEND}/schedule`)
      .then(r => r.json())
      .then(data => setScheduleEvents(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const createScheduleEvent = () => {
    if (!newScheduleTitle.trim() || !newScheduleTime) return;
    setSavingSchedule(true);
    apiFetch(`${BACKEND}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newScheduleTitle.trim(), remind_at: new Date(newScheduleTime).toISOString(), author: '檀' }),
    })
      .then(r => r.json())
      .then(data => {
        setScheduleEvents(es => [...es, data].sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at)));
        setNewScheduleTitle("");
        setNewScheduleTime("");
        setSavingSchedule(false);
      })
      .catch(err => { console.error(err); setSavingSchedule(false); });
  };

  const deleteScheduleEvent = (id) => {
    apiFetch(`${BACKEND}/schedule/${id}`, { method: 'DELETE' })
      .then(() => setScheduleEvents(es => es.filter(e => e.id !== id)))
      .catch(console.error);
  };

  const [wishes, setWishes] = useState([]);
  const [newWishText, setNewWishText] = useState("");

  const fetchWishes = () => {
    apiFetch(`${BACKEND}/wishes`)
      .then(r => r.json())
      .then(data => setWishes(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const addWish = () => {
    if (!newWishText.trim()) return;
    apiFetch(`${BACKEND}/wishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newWishText.trim(), author: '檀' }),
    })
      .then(r => r.json())
      .then(data => {
        setWishes(ws => [...ws, data]);
        setNewWishText("");
      })
      .catch(console.error);
  };

  const toggleWish = (id, done) => {
    apiFetch(`${BACKEND}/wishes/etInterval(() => { i++; setVisible(i); if (i >= msgs.length) clearInterval(t); }, 380);
    return () => clearInterval(t);
  }, [stage, ready, hasHistory]);

  useEffect(() => {
    if (scrollToMsgId) {
      const el = document.getElementById(`msg-${scrollToMsgId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setScrollToMsgId(null);
        return;
      }
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [visible, thinking, scrollToMsgId]);

  useEffect(() => {
    if (!pendingSearchJump || !msgs.some(message => message.id === pendingSearchJump.id)) return;
    setVisible(msgs.length);
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const element = document.getElementById(`msg-${pendingSearchJump.id}`);
        if (!element) return;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightMsgId(pendingSearchJump.id);
        setHighlightQuery(pendingSearchJump.query);
        setPendingSearchJump(null);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [msgs, pendingSearchJump]);

  useEffect(() => {
    apiFetch(`${BACKEND}/settings`)
      .then(r => r.json())
      .then(data => {
        if (data?.my_avatar_url) setMyAvatar(data.my_avatar_url);
        if (data?.partner_avatar_url) setPartnerAvatar(data.partner_avatar_url);
        if (data?.bg_image_url) setBgImage(data.bg_image_url);
        if (data?.bg_color) setBgColor(data.bg_color);
        if (data?.whisper_bg_image_url) setWhisperBgImage(data.whisper_bg_image_url);
        if (data?.whisper_bg_color) setWhisperBgColor(data.whisper_bg_color);
        if (data?.my_bubble_color) setMyBubbleColor(data.my_bubble_color);
        if (data?.partner_bubble_color) setPartnerBubbleColor(data.partner_bubble_color);
        if (typeof data?.dark_mode === 'boolean') setDarkMode(data.dark_mode);
        if (data?.font_style && FONT_STYLES[data.font_style]) {
          setFontStyle(data.font_style);
          applyAppFont(data.font_style);
        }
        if (data?.system_prompt) setSystemPromptInput(data.system_prompt);
        if (data?.selected_model) setSelectedModel(data.selected_model);
        if (typeof data?.temperature === 'number') setTemperatureInput(data.temperature);
      })
      .catch(console.error);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dark_mode: next }),
    }).catch(console.error);
  };

  const changeFontStyle = (key) => {
    setFontStyle(key);
    applyAppFont(key);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ font_style: key }),
    }).catch(console.error);
  };

  const savePersona = () => {
    if (!systemPromptInput.trim()) return;
    setSavingPersona(true);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system_prompt: systemPromptInput, temperature: Number(temperatureInput) }),
    })
      .then(() => setSavingPersona(false))
      .catch(err => { console.error(err); setSavingPersona(false); });
  };

  const chooseModel = (m) => {
    setSelectedModel(m);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_model: m }),
    }).catch(console.error);
  };

  const openLetters = () => {
    setView('letters');
    setLettersCategory(null);
    setDrawerOpen(false);
  };

  const fetchMonthEntries = (month) => {
    apiFetch(`${BACKEND}/calendar?month=${month}`)
      .then(r => r.json())
      .then(data => setMonthEntries(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const openCalendar = () => {
    setView('calendar');
    setDrawerOpen(false);
    fetchMonthEntries(calendarMonth);
    fetchSchedule();
    fetchWishes();
    fetchMilestones();
  };

  const fetchMilestones = () => {
    setMilestonesLoading(true);
    apiFetch(`${BACKEND}/milestones`)
      .then(r => r.json())
      .then(data => {
        setMilestones(Array.isArray(data) ? data : []);
        setMilestonesLoading(false);
      })
      .catch(err => { console.error(err); setMilestonesLoading(false); });
  };

  const addMilestone = () => {
    if (!newMilestoneName.trim() || !newMilestoneDate) return;
    apiFetch(`${BACKEND}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newMilestoneName.trim(), date: newMilestoneDate, emoji: '✦' }),
    })
      .then(r => r.json())
      .then(data => {
        setMilestones(ms => [...ms, data].sort((a, b) => new Date(a.date) - new Date(b.date)));
        setNewMilestoneName("");
        setNewMilestoneDate("");
      })
      .catch(console.error);
  };

  const deleteMilestoneRemote = (id) => {
    apiFetch(`${BACKEND}/milestones/${id}`, { method: 'DELETE' })
      .then(() => setMilestones(ms => ms.filter(m => m.id !== id)))
      .catch(console.error);
  };

  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [newScheduleTime, setNewScheduleTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchSchedule = () => {
    apiFetch(`${BACKEND}/schedule`)
      .then(r => r.json())
      .then(data => setScheduleEvents(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const createScheduleEvent = () => {
    if (!newScheduleTitle.trim() || !newScheduleTime) return;
    setSavingSchedule(true);
    apiFetch(`${BACKEND}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newScheduleTitle.trim(), remind_at: new Date(newScheduleTime).toISOString(), author: '檀' }),
    })
      .then(r => r.json())
      .then(data => {
        setScheduleEvents(es => [...es, data].sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at)));
        setNewScheduleTitle("");
        setNewScheduleTime("");
        setSavingSchedule(false);
      })
      .catch(err => { console.error(err); setSavingSchedule(false); });
  };

  const deleteScheduleEvent = (id) => {
    apiFetch(`${BACKEND}/schedule/${id}`, { method: 'DELETE' })
      .then(() => setScheduleEvents(es => es.filter(e => e.id !== id)))
      .catch(console.error);
  };

  const [wishes, setWishes] = useState([]);
  const [newWishText, setNewWishText] = useState("");

  const fetchWishes = () => {
    apiFetch(`${BACKEND}/wishes`)
      .then(r => r.json())
      .then(data => setWishes(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const addWish = () => {
    if (!newWishText.trim()) return;
    apiFetch(`${BACKEND}/wishes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newWishText.trim(), author: '檀' }),
    })
      .then(r => r.json())
      .then(data => {
        setWishes(ws => [...ws, data]);
        setNewWishText("");
      })
      .catch(console.error);
  };

  const toggleWish = (id, done) => {
    apiFetch(`${BACKEND}/wishes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    })
      .then(r => r.json())
      .then(data => setWishes(ws => ws.map(w => w.id === id ? data : w)))
      .catch(console.error);
  };

  const deleteWish = (id) => {
    apiFetch(`${BACKEND}/wishes/${id}`, { method: 'DELETE' })
      .then(() => setWishes(ws => ws.filter(w => w.id !== id)))
      .catch(console.error);
  };

  const changeMonth = (delta) => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setCalendarMonth(next);
    fetchMonthEntries(next);
  };

  const openDay = (dateStr) => {
    setCalendarDayOpen(dateStr);
    setDayEntriesLoading(true);
    setSelectedMood(null);
    setNewMoodText("");
    apiFetch(`${BACKEND}/calendar/${dateStr}`)
      .then(r => r.json())
      .then(data => {
        setDayEntries(Array.isArray(data) ? data : []);
        setDayEntriesLoading(false);
      })
      .catch(err => { console.error(err); setDayEntriesLoading(false); });
  };

  const submitMoodEntry = () => {
    if (!newMoodText.trim() || !calendarDayOpen) return;
    apiFetch(`${BACKEND}/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: calendarDayOpen, author: '檀', mood: selectedMood, content: newMoodText.trim() }),
    })
      .then(r => r.json())
      .then(data => {
        setDayEntries(es => [...es, data]);
        setNewMoodText("");
        setSelectedMood(null);
        fetchMonthEntries(calendarMonth);
      })
      .catch(console.error);
  };

  const [editingMoodId, setEditingMoodId] = useState(null);
  const [editingMoodText, setEditingMoodText] = useState("");
  const [aiMoodWriting, setAiMoodWriting] = useState(false);

  const startEditMood = (e) => { setEditingMoodId(e.id); setEditingMoodText(e.content); };
  const cancelEditMood = () => { setEditingMoodId(null); setEditingMoodText(""); };
  const saveEditMood = () => {
    const id = editingMoodId;
    const text = editingMoodText.trim();
    if (!text) return;
    apiFetch(`${BACKEND}/calendar/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
      .then(r => r.json())
      .then(data => {
        setDayEntries(es => es.map(x => x.id === id ? data : x));
        cancelEditMood();
      })
      .catch(console.error);
  };

  const deleteMoodEntry = (id) => {
    if (!window.confirm("确定要删掉这条留言吗？")) return;
    apiFetch(`${BACKEND}/calendar/${id}`, { method: 'DELETE' })
      .then(() => {
        setDayEntries(es => es.filter(x => x.id !== id));
        fetchMonthEntries(calendarMonth);
      })
      .catch(console.error);
  };

  const askAiWriteMood = () => {
    if (!calendarDayOpen) return;
    setAiMoodWriting(true);
    apiFetch(`${BACKEND}/calendar/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: calendarDayOpen, model: selectedModel }),
    })
      .then(r => r.json())
      .then(data => {
        setDayEntries(es => [...es, data]);
        setAiMoodWriting(false);
        fetchMonthEntries(calendarMonth);
      })
      .catch(err => { console.error(err); setAiMoodWriting(false); });
  };

  const backToChat = () => setView('chat');
  const leaveRoom = () => onHome ? onHome() : backToChat();
  const backToCabin = () => { setLettersCategory(null); setLetters([]); setOpenLetterId(null); };

  const openCategory = (cat) => {
    setLettersCategory(cat);
    setLettersLoading(true);
    apiFetch(`${BACKEND}/letters?category=${encodeURIComponent(cat)}`)
      .then(r => r.json())
      .then(data => {
        setLetters(Array.isArray(data) ? data : []);
        setLettersLoading(false);
      })
      .catch(err => { console.error(err); setLettersLoading(false); });
  };

  const submitNewLetter = () => {
    if (!newLetterText.trim() || savingLetter) return;
    if (lettersCategory === '幸福日记' && !newLetterTitle.trim()) return;
    setSavingLetter(true);
    apiFetch(`${BACKEND}/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: lettersCategory, author: '檀', content: newLetterText.trim(), title: lettersCategory === '幸福日记' ? newLetterTitle.trim() : null, paper_style: lettersCategory === '幸福日记' ? selectedPaperStyle : null }),
    })
      .then(r => r.json())
      .then(data => {
        setLetters(ls => [...ls, data]);
        setNewLetterText("");
        setNewLetterTitle("");
        setSavingLetter(false);
      })
      .catch(err => { console.error(err); setSavingLetter(false); });
  };

  const toggleReveal = (id) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submitReply = (parentId) => {
    if (!replyText.trim()) return;
    apiFetch(`${BACKEND}/letters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: lettersCategory, author: '檀', content: replyText.trim(), parent_id: parentId }),
    })
      .then(r => r.json())
      .then(data => {
        setLetters(ls => [...ls, data]);
        setReplyText("");
        setReplyingToId(null);
      })
      .catch(console.error);
  };

  const deleteLetter = (id) => {
    if (!window.confirm("确定要删掉这篇吗？里面的留言也会一起删掉，不能恢复。")) return;
    apiFetch(`${BACKEND}/letters/${id}`, { method: 'DELETE' })
      .then(() => {
        setLetters(ls => ls.filter(x => x.id !== id && x.parent_id !== id));
        if (openLetterId === id) setOpenLetterId(null);
      })
      .catch(console.error);
  };

  const [aiWriting, setAiWriting] = useState(null);
  const askAiWrite = (parentId) => {
    setAiWriting(parentId || 'new');
    apiFetch(`${BACKEND}/letters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: lettersCategory, parent_id: parentId || null, model: selectedModel }),
    })
      .then(r => r.json())
      .then(data => {
        setLetters(ls => [...ls, data]);
        setAiWriting(null);
        if (parentId) { setReplyingToId(null); setReplyText(""); }
      })
      .catch(err => { console.error(err); setAiWriting(null); });
  };

  const uploadBgImage = (file) => {
    if (!file) return;
    setUploadingBg(true);
    const formData = new FormData();
    formData.append('file', file);
    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => apiFetch(`${BACKEND}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bg_image_url: data.url, bg_color: null }),
      }).then(() => {
        setBgImage(data.url);
        setBgColor(null);
        setUploadingBg(false);
      }))
      .catch(err => { console.error(err); setUploadingBg(false); });
  };

  const setBackgroundColor = (color) => {
    setBgColor(color);
    setBgImage(null);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bg_color: color, bg_image_url: null }),
    }).catch(console.error);
  };

  const uploadWhisperBg = (file) => {
    if (!file) return;
    setUploadingWhisperBg(true);
    const formData = new FormData();
    formData.append('file', file);
    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => apiFetch(`${BACKEND}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whisper_bg_image_url: data.url, whisper_bg_color: null }),
      }).then(() => {
        setWhisperBgImage(data.url);
        setWhisperBgColor(null);
        setUploadingWhisperBg(false);
      }))
      .catch(err => { console.error(err); setUploadingWhisperBg(false); });
  };

  const setWhisperBackgroundColor = (color) => {
    setWhisperBgColor(color);
    setWhisperBgImage(null);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whisper_bg_color: color, whisper_bg_image_url: null }),
    }).catch(console.error);
  };

  const resetWhisperBackground = () => {
    setWhisperBgImage(null);
    setWhisperBgColor(null);