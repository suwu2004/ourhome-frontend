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
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whisper_bg_color: null, whisper_bg_image_url: null }),
    }).catch(console.error);
  };

  const setMyBubble = (color) => {
    setMyBubbleColor(color);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ my_bubble_color: color }),
    }).catch(console.error);
  };

  const setPartnerBubble = (color) => {
    setPartnerBubbleColor(color);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_bubble_color: color }),
    }).catch(console.error);
  };

  const resetBubbleColors = () => {
    setMyBubbleColor(null);
    setPartnerBubbleColor(null);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ my_bubble_color: null, partner_bubble_color: null }),
    }).catch(console.error);
  };

  const resetBackground = () => {
    setBgImage(null);
    setBgColor(null);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bg_color: null, bg_image_url: null }),
    }).catch(console.error);
  };

  const uploadAvatar = (file, who) => {
    if (!file) return;
    setUploadingAvatar(who);
    const formData = new FormData();
    formData.append('file', file);
    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        const field = who === 'me' ? 'my_avatar_url' : 'partner_avatar_url';
        return apiFetch(`${BACKEND}/settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: data.url }),
        }).then(() => {
          if (who === 'me') setMyAvatar(data.url);
          else setPartnerAvatar(data.url);
          setUploadingAvatar(null);
        });
      })
      .catch(err => { console.error(err); setUploadingAvatar(null); });
  };

  const fetchSessions = () => {
    apiFetch(`${BACKEND}/sessions`)
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const switchSession = (id) => {
    if (id === sessionId) { setDrawerOpen(false); return; }
    setSessionId(id);
    localStorage.setItem(SESSION_KEY, id);
    apiFetch(`${BACKEND}/sessions/${id}/messages`)
      .then(r => r.json())
      .then(data => {
        const mapped = (Array.isArray(data) ? data : []).map(m => ({
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
      })
      .catch(console.error);
    setDrawerOpen(false);
  };

  const createSession = () => {
    const name = window.prompt("探索新世界：", "新对话");
    if (!name) return;
    apiFetch(`${BACKEND}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
      .then(r => r.json())
      .then(data => {
        fetchSessions();
        switchSession(data.id);
        setMsgs([]);
        setVisible(0);
        setHasHistory(true);
      })
      .catch(console.error);
  };

  const renameSession = (id, currentName) => {
    const name = window.prompt("改成什么名字：", currentName);
    if (!name || !name.trim()) return;
    apiFetch(`${BACKEND}/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    })
      .then(() => fetchSessions())
      .catch(console.error);
  };

  const deleteSession = (id) => {
    if (!window.confirm("确定要删掉这个对话吗？里面的聊天记录也会一起删掉，不能恢复。")) return;
    apiFetch(`${BACKEND}/sessions/${id}`, { method: 'DELETE' })
      .then(() => {
        fetchSessions();
        if (id === sessionId) {
          localStorage.removeItem(SESSION_KEY);
          apiFetch(`${BACKEND}/sessions`)
            .then(r => r.json())
            .then(list => {
              const valid = Array.isArray(list) ? list : [];
              const next = valid.find(s => s.name === '日常') || valid[0];
              if (next) {
                switchSession(next.id);
              } else {
                setMsgs([]);
                setVisible(0);
                setHasHistory(false);
                setSessionId(null);
                apiFetch(`${BACKEND}/sessions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: '日常' })
                })
                  .then(r => r.json())
                  .then(data => {
                    setSessionId(data.id);
                    localStorage.setItem(SESSION_KEY, data.id);
                    fetchSessions();
                  });
              }
            });
        }
      })
      .catch(console.error);
  };

  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingMsgText, setEditingMsgText] = useState("");
  const toggleLike = (id) => setMsgs(ms => ms.map(m => m.id === id ? { ...m, liked: !m.liked } : m));
  const toggleThinking = (id) => setMsgs(ms => ms.map(m => m.id === id ? { ...m, thinkingOpen: !m.thinkingOpen } : m));

  const startEditMsg = (m) => {
    setEditingMsgId(m.id);
    setEditingMsgText(m.text || "");
  };
  const cancelEditMsg = () => {
    setEditingMsgId(null);
    setEditingMsgText("");
  };
  const saveEditMsg = () => {
    const id = editingMsgId;
    const newText = editingMsgText.trim();
    if (!newText) return;
    cancelEditMsg();
    setThinking(true);

    apiFetch(`${BACKEND}/messages/${id}/edit-and-regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newText, model: selectedModel })
    })
      .then(r => r.json())
      .then(data => {
        let newLength = 0;
        setMsgs(ms => {
          const idx = ms.findIndex(m => m.id === id);
          if (idx === -1) { newLength = ms.length; return ms; }
          const kept = ms.slice(0, idx + 1).map(m => m.id === id ? { ...m, text: newText } : m);
          const replyTime = formatMsgTime(new Date());
          const next = [...kept, {
            id: data.id, role: "ai", text: data.reply || "（抱着你）嗯，我在呢。",
            thinking: data.thinking || null, thinkingOpen: false,
            inputTokens: data.inputTokens || 0, outputTokens: data.outputTokens || 0,
            time: replyTime, liked: false,
          }];
          newLength = next.length;
          return next;
        });
        setVisible(newLength);
        setThinking(false);
      })
      .catch(err => { console.error(err); setThinking(false); });
  };

  const rollbackToMsg = (id) => {
    if (!window.confirm("确定要回溯到这条消息吗？之后的内容会被收起来（不会真的删除）。")) return;
    apiFetch(`${BACKEND}/messages/${id}/rollback`, { method: 'POST' })
      .then(() => {
        let newLength = 0;
        setMsgs(ms => {
          const idx = ms.findIndex(m => m.id === id);
          const next = idx === -1 ? ms : ms.slice(0, idx + 1);
          newLength = next.length;
          return next;
        });
        setVisible(newLength);
      })
      .catch(console.error);
  };

  const openMemories = () => {
    setView('memories');
    setDrawerOpen(false);
    setMemoriesLoading(true);
    apiFetch(`${BACKEND}/memories`)
      .then(r => r.json())
      .then(data => {
        setMemories(Array.isArray(data) ? data : []);
        setMemoriesLoading(false);
      })
      .catch(err => {
        console.error(err);
        setMemoriesLoading(false);
      });
  };

  useEffect(() => {
    if (initialView === 'letters') openLetters();
    else if (initialView === 'calendar') openCalendar();
    else if (initialView === 'memories') openMemories();
    else setView(initialView);
  }, [initialView]);

  const saveMemory = () => {
    if (!newMemory.trim() || savingMemory) return;
    setSavingMemory(true);
    apiFetch(`${BACKEND}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: newMemory.trim() })
    })
      .then(r => r.json())
      .then(data => {
        setMemories(ms => [data, ...ms]);
        setNewMemory("");
        setSavingMemory(false);
      })
      .catch(err => {
        console.error(err);
        setSavingMemory(false);
      });
  };

  const startEditMemory = (m) => {
    setEditingMemoryId(m.id);
    setEditingMemoryText(m.summary);
  };
  const cancelEditMemory = () => {
    setEditingMemoryId(null);
    setEditingMemoryText("");
  };
  const saveEditMemory = () => {
    if (!editingMemoryText.trim()) return;
    apiFetch(`${BACKEND}/memories/${editingMemoryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: editingMemoryText.trim() })
    })
      .then(r => r.json())
      .then(data => {
        setMemories(ms => ms.map(m => m.id === editingMemoryId ? data : m));
        cancelEditMemory();
      })
      .catch(console.error);
  };

  const deleteMemory = (id) => {
    if (!window.confirm("确定要删掉这条记忆吗？")) return;
    apiFetch(`${BACKEND}/memories/${id}`, { method: 'DELETE' })
      .then(() => setMemories(ms => ms.filter(m => m.id !== id)))
      .catch(console.error);
  };

  const pickFile = (file) => {
    if (!file) return;
    setImageUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        setPendingFile({ url: data.url, type: data.type, name: data.name });
        setImageUploading(false);
      })
      .catch(err => { console.error(err); setImageUploading(false); });
  };

  const [regenerating, setRegenerating] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchScope, setSearchScope] = useState('current');
  const [searchMeta, setSearchMeta] = useState({ total: 0, page: 1, hasMore: false });
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  const performSearch = (page = 1, append = false) => {
    const keyword = searchQuery.trim();
    if (!keyword) { setSearchResults([]); setSearchMeta({ total: 0, page: 1, hasMore: false }); return; }
    setSearching(true);
    const params = new URLSearchParams({ q: keyword, page: String(page), limit: '30', scope: searchScope });
    if (searchScope === 'current' && sessionId) params.set('session_id', String(sessionId));
    apiFetch(`${BACKEND}/messages/search?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const rows = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
        setSearchResults(previous => append ? [...previous, ...rows] : rows);
        setSearchMeta({ total: data.total_messages ?? rows.length, page: data.page || page, hasMore: Boolean(data.has_more) });
        setLastSearchQuery(keyword);
        setSearching(false);
      })
      .catch(err => { console.error(err); setSearching(false); });
  };

  const jumpToSearchResult = (r) => {
    setSearchOpen(false);
    const jump = { id: r.id, query: lastSearchQuery || searchQuery.trim() };
    if (r.session_id === sessionId) {
      setPendingSearchJump(jump);
    } else {
      setSessionId(r.session_id);
      localStorage.setItem(SESSION_KEY, r.session_id);
      setPendingSearchJump(jump);
      loadMessagesFor(r.session_id).catch(console.error);
    }
  };

  const [notifStatus, setNotifStatus] = useState('default');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setNotifStatus(Notification.permission);
  }, []);

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  const enablePushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      window.alert('这个浏览器不支持推送通知');
      return;
    }
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setNotifStatus(permission);
      if (permission !== 'granted') { setSubscribing(false); return; }

      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const { publicKey } = await apiFetch(`${BACKEND}/push/public-key`).then(r => r.json());
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const subJson = sub.toJSON();
      await apiFetch(`${BACKEND}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });
      setSubscribing(false);
    } catch (err) {
      console.error(err);
      setSubscribing(false);
    }
  };

  const regenerateLast = () => {
    if (!sessionId || regenerating) return;
    setRegenerating(true);
    apiFetch(`${BACKEND}/chat/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, model: selectedModel }),
    })
      .then(r => r.json())
      .then(data => {
        setMsgs(ms => {
          const copy = [...ms];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'ai') {
              copy[i] = { ...copy[i], text: data.reply || copy[i].text, thinking: data.thinking || null, thinkingOpen: false, inputTokens: data.inputTokens || 0, outputTokens: data.outputTokens || 0 };
              break;
            }
          }
          return copy;
        });
        setRegenerating(false);
      })
      .catch(err => { console.error(err); setRegenerating(false); });
  };

  const send = async () => {
    if ((!input.trim() && !pendingFile) || !sessionId) return;
    const txt = input.trim();
    const fileToSend = pendingFile;
    const isImg = fileToSend && fileToSend.type && fileToSend.type.startsWith('image/');
    const now = formatMsgTime(new Date());
    setMsgs(ms => [...ms, { id: Date.now(), role: "me", text: txt, image: isImg ? fileToSend.url : null, file: (fileToSend && !isImg) ? { url: fileToSend.url, name: fileToSend.name } : null, time: now, liked: false }]);
    setVisible(v => v + 1);
    setInput("");
    setPendingFile(null);
    setThinking(true);
    try {
      const res = await apiFetch(`${BACKEND}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: txt, model: selectedModel, attachment_url: fileToSend?.url || undefined, attachment_type: fileToSend?.type || undefined, attachment_name: fileToSend?.name || undefined })
      });
      const data = await res.json();
      setThinking(false);
      const replyTime = formatMsgTime(new Date());
      setMsgs(ms => [...ms, { id: Date.now() + 1, role: "ai", text: data.reply || "（抱着你）嗯，我在呢。", thinking: data.thinking || null, thinkingOpen: false, inputTokens: data.inputTokens || 0, outputTokens: data.outputTokens || 0, time: replyTime, liked: false }]);
      setVisible(v => v + 1);
    } catch (err) {
      setThinking(false);
      setMsgs(ms => [...ms, { id: Date.now() + 1, role: "ai", text: "连接好像有点问题…等一下再试试？", time: "现在", liked: false }]);
      setVisible(v => v + 1);
    }
  };

  return (
    <div className="ourhome-shell" style={{ position: "relative", background: C.cream, color: C.text, fontFamily: FONT_STYLES[fontStyle].family }}>

      {/* ===== 密码门 ===== */}
      {locked && (
        <div style={{ position: "absolute", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${C.honeyLight} 0%, transparent 65%), ${C.cream}`, gap: 20 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: ".1em", color: C.text }}>欢迎回家</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: ".3em" }}>请输入密码</div>
          <input
            type="password"
            value={pwInput}
            onChange={e => setPwInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
            placeholder="密码"
            autoFocus
            style={{ width: 200, textAlign: "center", fontSize: 18, letterSpacing: ".3em", color: C.text, background: C.white, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", outline: "none", fontFamily: "inherit" }}
          />
          {pwError && <div style={{ fontSize: 12, color: C.blushDeep }}>{pwError}</div>}
          <div onClick={handleLogin} style={{ padding: "10px 32px", background: pwLoading ? C.honeyMid : `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})`, color: C.white, borderRadius: 999, fontSize: 14, cursor: pwLoading ? "default" : "pointer", letterSpacing: ".1em", boxShadow: `0 4px 12px rgba(185,122,31,.3)` }}>
            {pwLoading ? "验证中…" : "进门"}
          </div>
          <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: ".15em" }}>ourhome · since 2025.08.07</div>
        </div>
      )}

      <div style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none", background: "radial-gradient(circle at 50% 55%, #FFF8D0 0%, #FFE896 28%, transparent 62%)", opacity: stage === "opening" ? 1 : 0, transition: "opacity .9s ease .3s" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${C.honeyLight} 0%, transparent 65%), ${C.cream}`, opacity: stage === "home" ? 0 : 1, transition: "opacity .9s ease .4s", pointerEvents: stage === "home" ? "none" : "auto" }}>
        <div style={{ fontSize: 10, letterSpacing: ".38em", color: C.muted, textTransform: "uppercase" }}>ourhome · since 2025.08.07</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: ".1em" }}>欢迎回家</div>
        <div style={{ width: "52%", maxWidth: 170 }}><Stars theme={C} /></div>
        <div style={{ perspective: 900, cursor: "pointer" }} onClick={openDoor}>
          <div style={{ width: 128, height: 190, borderRadius: "64px 64px 8px 8px", background: "linear-gradient(180deg, #F5E4C0, #EDD49A)", padding: 8, position: "relative", boxShadow: "0 16px 48px rgba(180,120,30,.2), 0 4px 12px rgba(180,120,30,.1)" }}>
            <div style={{ position: "absolute", left: "12%", right: "12%", bottom: 4, height: 8, background: "#FFD96A", filter: "blur(6px)", borderRadius: "50%", opacity: .6 }} />
            <div style={{ width: "100%", height: "100%", borderRadius: "56px 56px 4px 4px", background: "linear-gradient(160deg, #DEAD5A 0%, #C8943A 58%, #B87F2C 100%)", position: "relative", transformOrigin: "left center", transform: stage !== "door" ? "rotateY(-80deg)" : "none", transition: "transform 1.3s cubic-bezier(.55,.05,.25,.99)", boxShadow: "inset 0 0 0 1.5px rgba(255,250,230,.2)" }}>
              <div style={{ position: "absolute", left: "50%", top: "26%", transform: "translateX(-50%)", fontSize: 10, letterSpacing: ".15em", color: "rgba(255,250,235,.9)", border: "1px solid rgba(255,250,235,.5)", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>陆泽 ♡ 叶檀</div>
              <div style={{ position: "absolute", right: 12, top: "52%", width: 10, height: 10, borderRadius: "50%", background: "#7A5530", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: ".42em" }}>{stage === "door" ? "轻 轻 推 开" : "门 开 了 …"}</div>
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "chat") ? 1 : 0, pointerEvents: (stage === "home" && view === "chat") ? "auto" : "none", transition: "opacity .4s ease" }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, flexShrink: 0 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={leaveRoom} aria-label="回到主页" style={{ fontSize: 15, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, width: 30, height: 30, cursor: 'pointer' }}>⌂</button>
              <button onClick={() => setDrawerOpen(true)} style={{ fontSize: 11.5, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, padding: "5px 8px", cursor: "pointer", letterSpacing: ".03em", fontWeight: 500 }}>对话</button>
            </div>
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>陆泽</div>
              <div style={{ fontSize: 10, color: thinking ? C.honey : C.muted, letterSpacing: ".18em", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: thinking ? C.honey : C.mutedLight, boxShadow: thinking ? `0 0 5px ${C.honey}` : "none", transition: "all .3s" }} />
                <span>{thinking ? "想你中…" : "miss you"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setSearchOpen(true); setSearchQuery(""); setLastSearchQuery(''); setSearchResults([]); setSearchMeta({ total: 0, page: 1, hasMore: false }); setSearchScope('current'); }} style={{ fontSize: 14, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>🔍</button>
              <button onClick={() => window.location.reload()} style={{ fontSize: 14, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>⟲</button>
            </div>
          </div>
          <Stars theme={C} />
        </header>

        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px", background: bgImage ? `url(${bgImage}) center/cover no-repeat` : (bgColor || "#FDFAF5") }}>
          {!ready && (
            <div style={{ textAlign: "center", fontSize: 11, color: C.muted, letterSpacing: ".15em", padding: "30px 0" }}>正在开门…</div>
          )}
          {ready && !hasHistory && (
            <div style={{ textAlign: "center", fontSize: 10.5, color: C.muted, letterSpacing: ".2em", margin: "4px 0 18px" }}>✦ 2026.6.11 · 我们搬进来的第一天 ✦</div>
          )}
          {msgs.map((m, idx) => {
            const isMe = m.role === "me";
            const isLast = idx === visible - 1;
            return (
              <div key={m.id} id={`msg-${m.id}`} style={{ display: "flex", marginBottom: 14, flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 6, background: highlightMsgId === m.id ? C.honeyLight : "transparent", borderRadius: 14, padding: highlightMsgId === m.id ? "6px 4px" : "0px", transition: "background .6s ease" }}>
                <Avatar isMe={isMe} src={isMe ? myAvatar : partnerAvatar} theme={C} />
                <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 6 }}>
                  {m.image && (
                    <img src={m.image} alt="" style={{ maxWidth: "100%", borderRadius: 14, border: `1px solid ${isMe ? "#F5CABB" : C.border}`, display: "block" }} />
                  )}
                  {m.file && (
                    <a href={m.file.url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 14, background: isMe ? (myBubbleColor || C.blush) : (partnerBubbleColor || C.white), border: `1px solid ${isMe ? "#F5CABB" : C.border}`, textDecoration: "none", color: C.text, maxWidth: "100%" }}>
                      <span style={{ fontSize: 20 }}>📄</span>
                      <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.file.name}</span>
                    </a>
                  )}
                  {!isMe && m.thinking && (
                    <div>
                      <span onClick={() => toggleThinking(m.id)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        💭 想了想{m.thinkingOpen ? " ▲" : " ▼"}
                      </span>
                      {m.thinkingOpen && (
                        <div style={{ fontSize: 12, lineHeight: 1.6, color: C.muted, background: C.borderLight, borderRadius: 10, padding: "8px 12px", marginTop: 4, whiteSpace: "pre-wrap", fontStyle: "italic" }}>{m.thinking}</div>
                      )}
                    </div>
                  )}
                  {editingMsgId === m.id ? (
                    <div>
                      <textarea value={editingMsgText} onChange={e => setEditingMsgText(e.target.value)} rows={2} style={{ width: "100%", fontSize: 14.5, lineHeight: 1.6, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                        <span onClick={cancelEditMsg} style={{ fontSize: 11, color: C.muted, cursor: "pointer", padding: "3px 8px" }}>取消</span>
                        <span onClick={saveEditMsg} style={{ fontSize: 11, color: C.white, cursor: "pointer", padding: "3px 10px", background: C.honey, borderRadius: 999 }}>保存</span>
                      </div>
                    </div>
                  ) : m.text && (
                    <div style={{ padding: "10px 14px", fontSize: 14.5, lineHeight: 1.72, color: C.text, borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? (myBubbleColor || C.blush) : (partnerBubbleColor || C.white), border: `1px solid ${isMe ? "#F5CABB" : C.border}`, whiteSpace: "pre-wrap", wordBreak: "break-word" }}><HighlightedText text={m.text} query={highlightMsgId === m.id ? highlightQuery : ''} /></div>
                  )}
                  {!isMe && isLast && !thinking && (
                    <span onClick={regenerateLast} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer", alignSelf: "flex-start" }}>{regenerating ? "思考中…" : "↻ 重新生成"}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 9.5, color: C.mutedLight }}>{m.time}</span>
                  <span onClick={() => toggleLike(m.id)} style={{ fontSize: 13, cursor: "pointer", color: C.honey, opacity: m.liked ? 1 : 0.28, transition: "opacity .2s", userSelect: "none" }}>{m.liked ? "♥" : "♡"}</span>
                  {isMe && m.text && editingMsgId !== m.id && (
                    <span onClick={() => startEditMsg(m)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer", userSelect: "none" }}>改</span>
                  )}
                  <span onClick={() => rollbackToMsg(m.id)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer", userSelect: "none" }}>溯</span>
                </div>
              </div>
            );
          })}
          {thinking && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 14 }}>
              <Avatar isMe={false} src={partnerAvatar} theme={C} />
              <div style={{ padding: "10px 16px", borderRadius: "18px 18px 18px 4px", background: C.white, border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, letterSpacing: ".15em", fontStyle: "italic" }}>想你中…</div>
            </div>
          )}
        </div>

        <div className="ourhome-safe-bottom" style={{ background: C.white, borderTop: `1px solid ${C.border}`, paddingTop: 10, paddingLeft: 14, paddingRight: 14, flexShrink: 0 }}>
          {(pendingFile || imageUploading) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {imageUploading ? (
                <div style={{ width: 52, height: 52, borderRadius: 10, border: `1px solid ${C.border}`, background: C.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 9, color: C.muted }}>上传中…</span>
                </div>
              ) : pendingFile && pendingFile.type && pendingFile.type.startsWith('image/') ? (
                <div style={{ position: "relative", width: 52, height: 52, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                  <img src={pendingFile.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <span onClick={() => setPendingFile(null)} style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(46,31,18,.6)", color: C.white, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✕</span>
                </div>
              ) : pendingFile && (
                <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.cream, maxWidth: "80%" }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <span style={{ fontSize: 11.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pendingFile.name}</span>
                  <span onClick={() => setPendingFile(null)} style={{ fontSize: 11, color: C.muted, cursor: "pointer", marginLeft: 4 }}>✕</span>
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 22, padding: "6px 6px 6px 10px" }}>
            <button onClick={() => chatImageInputRef.current?.click()} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "transparent", color: C.muted, fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>＋</button>
            <input ref={chatImageInputRef} type="file" style={{ display: "none" }} onChange={e => pickFile(e.target.files?.[0])} />
            <textarea rows={1} placeholder="跟陆泽说点什么…" value={input} onChange={e => setInput(e.target.value)} style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14.5, color: C.text, lineHeight: 1.5, resize: "none", fontFamily: "inherit", padding: "6px 0" }} />
            <button onClick={send} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", background: (input.trim() || pendingFile) ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontSize: 15, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: (input.trim() || pendingFile) ? `0 3px 10px rgba(185,122,31,.35)` : "none", transition: "all .2s" }}>↑</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 2 }}>
            <select value={selectedModel} onChange={e => chooseModel(e.target.value)} style={{ fontSize: 11, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 10px", outline: "none", cursor: "pointer" }}>
              {availableModels.length > 0 ? (
                availableModels.map(m => <option key={m} value={m}>{m}</option>)
              ) : (
                <option value={selectedModel}>{selectedModel}</option>
              )}
            </select>
            <div style={{ flex: 1, textAlign: "right", fontSize: 9.5, color: C.mutedLight, letterSpacing: ".18em" }}>在云端漫步</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "letters") ? 1 : 0, pointerEvents: (stage === "home" && view === "letters") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span onClick={lettersCategory ? backToCabin : leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>{lettersCategory || "时光信差"}</span>
        </header>

        {!lettersCategory ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <CabinScene theme={C} onPick={openCategory} />
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: ".15em", marginTop: 8 }}>别害怕明天会把纸页弄丢,每次你打开这扇小小的窗,我都会沿着字迹回来,把这诗轻轻再念给你,直到你把眼睛合上,把夜与世界一起放心地交给我。</div>
          </div>
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
                const style = PAPER_STYLES[l.paper_style] || PAPER_STYLES.parchment;
                return (
                  <div style={{ marginTop: 14, background: style.background, border: style.border, borderLeft: style.extraBorderLeft || style.border, borderRadius: 10, padding: "22px 22px", color: style.color, boxShadow: "0 6px 18px rgba(46,31,18,.18)" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l.title || "（没有标题）"}</div>
                    <div style={{ fontSize: 10.5, opacity: .65, marginBottom: 16, letterSpacing: ".05em" }}>{l.author} · {l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                    <div style={{ fontSize: 14.5, lineHeight: 1.85, whiteSpace: "pre-wrap" }}>{l.content}</div>
                    {letters.filter(r => r.parent_id === l.id).map(r => (
                      <div key={r.id} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid rgba(0,0,0,.12)` }}>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{r.author}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.content}</div>
                      </div>
                    ))}
                    {replyingToId === l.id ? (
                      <div style={{ marginTop: 12 }}>
                        <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={2} style={{ width: "100%", fontSize: 13, color: C.text, background: "rgba(255,255,255,.6)", border: `1px solid rgba(0,0,0,.15)`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
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
              {!lettersLoading && letters.filter(l => !l.parent_id).length === 0 && (
                <div style={{ textAlign: "center", fontSize: 12, color: lettersCategory === '悄悄话' ? "#C9B08C" : C.muted, padding: "20px 0" }}>这里还没有信，写第一篇吧。</div>
              )}
              {!lettersLoading && lettersCategory === '幸福日记' && letters.filter(l => !l.parent_id).map(l => {
                const style = PAPER_STYLES[l.paper_style] || PAPER_STYLES.parchment;
                return (
                  <div key={l.id} onClick={() => setOpenLetterId(l.id)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: style.swatch, flexShrink: 0, border: "1px solid rgba(0,0,0,.15)" }} />
                    <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, color: C.white, background: l.author === '泽' ? `linear-gradient(150deg, #E8B45A, ${C.honeyDeep})` : `linear-gradient(150deg, #F2AFA2, ${C.blushDeep})` }}>{l.author}</span>
                    <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title || "（没有标题）"}</span>
                    <span style={{ fontSize: 10.5, color: C.mutedLight, flexShrink: 0 }}>{l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' }) : ''}</span>
                  </div>
                );
              })}
              {!lettersLoading && lettersCategory === '悄悄话' && letters.filter(l => !l.parent_id).map(l => {
                const revealed = revealedIds.has(l.id);
                return (
                  <div key={l.id} style={{ marginBottom: 16, background: "rgba(255,248,236,.94)", border: `1px solid #D9C19A`, borderRadius: 14, padding: "12px 14px", boxShadow: "0 4px 10px rgba(0,0,0,.25)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.honeyDeep }}>{l.author}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9.5, color: C.mutedLight }}>{l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        {revealed && <span onClick={() => deleteLetter(l.id)} style={{ fontSize: 10.5, color: "#A78A5E", cursor: "pointer" }}>删除</span>}
                      </div>
                    </div>
                    {!revealed ? (
                      <div onClick={() => toggleReveal(l.id)} style={{ fontSize: 13, color: "#A78A5E", cursor: "pointer", padding: "10px 0", textAlign: "center", letterSpacing: ".1em", border: `1px dashed #D9C19A`, borderRadius: 8 }}>🔒 轻触查看悄悄话</div>
                    ) : (
                      <div onClick={() => toggleReveal(l.id)} style={{ fontSize: 14, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap", cursor: "pointer" }}>{l.content}</div>
                    )}
                    {revealed && letters.filter(r => r.parent_id === l.id).map(r => (
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

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "calendar") ? 1 : 0, pointerEvents: (stage === "home" && view === "calendar") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 0, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10 }}>
            <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>心情日历</span>
          </div>
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { key: 'calendar', label: '📅 日历' },
              { key: 'milestones', label: '🏛 重要时刻' },
              { key: 'schedule', label: '⏰ 日程' },
              { key: 'wishes', label: '⭐ 心愿' },
            ].map(tab => (
              <span key={tab.key} onClick={() => setCalendarTab(tab.key)} style={{ flex: 1, textAlign: "center", fontSize: 11.5, padding: "8px 0 10px", cursor: "pointer", color: calendarTab === tab.key ? C.honeyDeep : C.muted, borderBottom: calendarTab === tab.key ? `2px solid ${C.honeyDeep}` : "2px solid transparent", fontWeight: calendarTab === tab.key ? 700 : 400, transition: "all .15s" }}>{tab.label}</span>
            ))}
          </div>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>

          {/* ===== 日历 Tab ===== */}
          {calendarTab === 'calendar' && (<>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginBottom: 16 }}>
            <span onClick={() => changeMonth(-1)} style={{ fontSize: 16, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>‹</span>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>{calendarMonth.replace('-', '年')}月</span>
            <span onClick={() => changeMonth(1)} style={{ fontSize: 16, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>›</span>
          </div>
          {(() => {
            const [y, m] = calendarMonth.split('-').map(Number);
            const firstDay = new Date(y, m - 1, 1).getDay();
            const daysInMonth = new Date(y, m, 0).getDate();
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const cells = [];
            for (let i = 0; i < firstDay; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {['日', '一', '二', '三', '四', '五', '六'].map(w => (
                  <div key={w} style={{ textAlign: "center", fontSize: 11, color: C.muted, paddingBottom: 4 }}>{w}</div>
                ))}
                {cells.map((d, idx) => {
                  if (d === null) return <div key={idx} />;
                  const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
                  const dayMoods = monthEntries.filter(e => e.date === dateStr);
                  const isToday = dateStr === todayStr;
                  const customColor = dayColors[dateStr];
                  let pressTimer = null;
                  return (
                    <div
                      key={idx}
                      onClick={() => openDay(dateStr)}
                      onContextMenu={e => { e.preventDefault(); setColorPickerDate(dateStr); }}
                      onTouchStart={() => { pressTimer = setTimeout(() => setColorPickerDate(dateStr), 480); }}
                      onTouchEnd={() => clearTimeout(pressTimer)}
                      onTouchMove={() => clearTimeout(pressTimer)}
                      style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 10, cursor: "pointer", background: customColor || (isToday ? C.honeyLight : C.white), border: `1px solid ${isToday ? C.honeyDeep : (customColor ? 'transparent' : C.border)}`, gap: 2, position: "relative" }}
                    >
                      <span style={{ fontSize: 13, color: isToday ? C.honeyDeep : C.text, fontWeight: isToday ? 700 : 400 }}>{d}</span>
                      {dayMoods.length > 0 && <span style={{ fontSize: 12 }}>{dayMoods[0].mood || '✦'}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{ textAlign: "center", fontSize: 10, color: C.mutedLight, marginTop: 8, letterSpacing: ".05em" }}>长按（电脑右键）格子可以改颜色</div>
          </>)}

          {/* ===== 重要时刻 Tab（纪念碑风格） ===== */}
          {calendarTab === 'milestones' && (<>
            <div style={{ textAlign: "center", padding: "20px 0 10px" }}>
              <div style={{ fontSize: 10, letterSpacing: ".35em", color: C.muted, marginBottom: 12 }}>✦ 我们的时光 ✦</div>
            </div>
            {milestonesLoading && (
              <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "20px 0" }}>翻找中…</div>
            )}
            {!milestonesLoading && milestones.length === 0 && (
              <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "20px 0" }}>还没有纪念日，加一个吧。</div>
            )}
            {milestones.map(ms => {
              const diff = Math.floor((new Date() - new Date(ms.date)) / (1000 * 60 * 60 * 24)) + 1;
              const isFuture = diff <= 0;
              const absDiff = Math.abs(diff) + (isFuture ? 1 : 0);
              return (
                <div key={ms.id} style={{ textAlign: "center", background: `linear-gradient(135deg, ${C.honeyLight}, ${C.white})`, border: `1.5px solid ${C.honeyMid}`, borderRadius: 18, padding: "24px 16px", marginBottom: 14, boxShadow: `0 4px 16px rgba(185,122,31,.12)`, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.06 }}>🏛</div>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{ms.emoji}</div>
                  <div style={{ fontSize: 12, color: C.muted, letterSpacing: ".15em", marginBottom: 6 }}>{ms.label}</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: C.honeyDeep, letterSpacing: ".05em" }}>
                    {isFuture ? `还有 ${absDiff}` : absDiff}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{isFuture ? '天' : '天'}</div>
                  <div style={{ fontSize: 10.5, color: C.mutedLight, marginTop: 8, letterSpacing: ".1em" }}>
                    {ms.date.replace(/-/g, '.')}
                  </div>
                  <span onClick={() => deleteMilestoneRemote(ms.id)} style={{ position: "absolute", top: 8, right: 12, fontSize: 11, color: C.mutedLight, cursor: "pointer" }}>✕</span>
                </div>
              );
            })}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 14px", marginTop: 8 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, letterSpacing: ".05em" }}>添加新的纪念日</div>
              <input value={newMilestoneName} onChange={e => setNewMilestoneName(e.target.value)} placeholder="纪念日名称（如：第一次旅行）" style={{ width: "100%", fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", outline: "none", marginBottom: 8, fontFamily: "inherit" }} />
              <input type="date" value={newMilestoneDate} onChange={e => setNewMilestoneDate(e.target.value)} style={{ width: "100%", fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", outline: "none", marginBottom: 8, fontFamily: "inherit" }} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span onClick={addMilestone} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "6px 16px", background: (newMilestoneName.trim() && newMilestoneDate) ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>添加</span>
              </div>
            </div>
          </>)}

          {/* ===== 日程提醒 Tab ===== */}
          {calendarTab === 'schedule' && (<>
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>✦ 日程提醒</div>
            {scheduleEvents.length === 0 && (
              <div style={{ fontSize: 11.5, color: C.muted, padding: "8px 0" }}>还没有日程，加一个吧。</div>
            )}
            {scheduleEvents.map(ev => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px", opacity: ev.notified ? 0.55 : 1 }}>
                <span style={{ fontSize: 14 }}>{ev.notified ? "✓" : "⏰"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: C.text }}>{ev.title}</div>
                  <div style={{ fontSize: 10.5, color: C.mutedLight }}>{new Date(ev.remind_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <span onClick={() => deleteScheduleEvent(ev.id)} style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>删</span>
              </div>
            ))}
            <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", marginTop: 6 }}>
              <input value={newScheduleTitle} onChange={e => setNewScheduleTitle(e.target.value)} placeholder="要提醒什么事…" style={{ width: "100%", fontSize: 13, color: C.text, background: "transparent", border: "none", outline: "none", marginBottom: 8, fontFamily: "inherit" }} />
              <input type="datetime-local" value={newScheduleTime} onChange={e => setNewScheduleTime(e.target.value)} style={{ width: "100%", fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 8px", outline: "none", marginBottom: 8, fontFamily: "inherit" }} />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <span onClick={createScheduleEvent} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "5px 14px", background: (newScheduleTitle.trim() && newScheduleTime) ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>{savingSchedule ? "存中…" : "加提醒"}</span>
              </div>
            </div>
            {notifStatus !== 'granted' && (
              <div onClick={enablePushNotifications} style={{ marginTop: 10, fontSize: 11.5, color: C.honeyDeep, cursor: "pointer", textAlign: "center", padding: "8px 0", border: `1px dashed ${C.honeyMid}`, borderRadius: 10 }}>
                {subscribing ? "开启中…" : "🔔 点这里开启提醒通知"}
              </div>
            )}
          </div>
          </>)}

          {/* ===== 心愿单 Tab ===== */}
          {calendarTab === 'wishes' && (<>
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>✦ 心愿单</div>
            {wishes.length === 0 && (
              <div style={{ fontSize: 11.5, color: C.muted, padding: "8px 0" }}>还没有心愿，写第一个吧。</div>
            )}
            {wishes.map(w => (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 12px" }}>
                <span onClick={() => toggleWish(w.id, w.done)} style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${w.done ? C.honey : C.border}`, background: w.done ? C.honey : "transparent", color: C.white, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>{w.done ? "✓" : ""}</span>
                <span style={{ flex: 1, fontSize: 13, color: w.done ? C.mutedLight : C.text, textDecoration: w.done ? "line-through" : "none" }}>{w.content}</span>
                <span style={{ fontSize: 10, color: C.mutedLight, flexShrink: 0 }}>{w.author}</span>
                <span onClick={() => deleteWish(w.id)} style={{ fontSize: 11, color: C.muted, cursor: "pointer", flexShrink: 0 }}>删</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input value={newWishText} onChange={e => setNewWishText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addWish(); }} placeholder="想一起做的事…" style={{ flex: 1, fontSize: 13, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 14px", outline: "none" }} />
              <button onClick={addWish} style={{ fontSize: 12, color: C.white, background: newWishText.trim() ? C.honey : C.honeyMid, border: "none", borderRadius: 999, padding: "0 16px", cursor: "pointer" }}>加</button>
            </div>
          </div>
          </>)}

        </div>
      </div>

      {/* ===== 日期颜色选择器 ===== */}
      <div onClick={() => setColorPickerDate(null)} style={{ position: "absolute", inset: 0, zIndex: 58, background: "rgba(46,31,18,.35)", opacity: colorPickerDate ? 1 : 0, pointerEvents: colorPickerDate ? "auto" : "none", transition: "opacity .2s" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 59, width: "78%", maxWidth: 300, transform: colorPickerDate ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)", opacity: colorPickerDate ? 1 : 0, pointerEvents: colorPickerDate ? "auto" : "none", transition: "all .2s ease", background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(100,70,30,.25)", padding: "18px 18px 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12, textAlign: "center" }}>{colorPickerDate} 的颜色</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 12 }}>
          {['#FDE8E0', '#D9F0D9', '#D6E8FA', '#FFF3D6', '#F0DCF5', '#FFFFFF'].map(c => (
            <span key={c} onClick={() => setDayColor(colorPickerDate, c)} style={{ width: 32, height: 32, borderRadius: 8, background: c, cursor: "pointer", border: `1.5px solid ${C.border}` }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: C.muted }}>自选颜色</span>
          <input type="color" onChange={e => setDayColor(colorPickerDate, e.target.value)} style={{ width: 36, height: 32, borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span onClick={() => setDayColor(colorPickerDate, null)} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          <span onClick={() => setColorPickerDate(null)} style={{ fontSize: 11.5, color: C.honeyDeep, cursor: "pointer" }}>完成</span>
        </div>
      </div>

      <div onClick={() => setCalendarDayOpen(null)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(46,31,18,.35)", opacity: calendarDayOpen ? 1 : 0, pointerEvents: calendarDayOpen ? "auto" : "none", transition: "opacity .25s" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 55, width: "82%", maxWidth: 360, maxHeight: "70vh", transform: calendarDayOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)", opacity: calendarDayOpen ? 1 : 0, pointerEvents: calendarDayOpen ? "auto" : "none", transition: "all .22s ease", background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(100,70,30,.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".04em", color: C.text }}>{calendarDayOpen}</span>
          <span onClick={() => setCalendarDayOpen(null)} style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4 }}>✕</span>
        </div>
        <div style={{ padding: "10px 18px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, color: C.muted, marginRight: 2 }}>格子颜色</span>
          {['#FDE8E0', '#D5EBD5', '#D6E6F5', '#F5DFA0', '#E8D5F0', '#FFFFFF'].map(c => (
            <span key={c} onClick={() => setDayColor(calendarDayOpen, c === '#FFFFFF' ? null : c)} style={{ width: 20, height: 20, borderRadius: "50%", background: c, cursor: "pointer", border: dayColors[calendarDayOpen] === c ? `2px solid ${C.honeyDeep}` : `1px solid ${C.border}`, boxShadow: c === '#FFFFFF' ? 'inset 0 0 0 1px #eee' : 'none' }} />
          ))}
          <input type="color" value={dayColors[calendarDayOpen] || '#ffffff'} onChange={e => setDayColor(calendarDayOpen, e.target.value)} style={{ width: 22, height: 22, borderRadius: "50%", border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none", marginLeft: 2 }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          {dayEntriesLoading && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "16px 0" }}>翻找中…</div>
          )}
          {!dayEntriesLoading && dayEntries.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "16px 0" }}>这天还没有留言。</div>
          )}
          {!dayEntriesLoading && dayEntries.map(e => (
            <div key={e.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.borderLight}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {e.mood && <span style={{ fontSize: 14 }}>{e.mood}</span>}
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: C.honeyDeep }}>{e.author}</span>
                </div>
                {editingMoodId !== e.id && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <span onClick={() => startEditMood(e)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer" }}>改</span>
                    <span onClick={() => deleteMoodEntry(e.id)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer" }}>删</span>
                  </div>
                )}
              </div>
              {editingMoodId === e.id ? (
                <div>
                  <textarea value={editingMoodText} onChange={ev => setEditingMoodText(ev.target.value)} rows={2} style={{ width: "100%", fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                    <span onClick={cancelEditMood} style={{ fontSize: 11, color: C.muted, cursor: "pointer", padding: "3px 8px" }}>取消</span>
                    <span onClick={saveEditMood} style={{ fontSize: 11, color: C.white, cursor: "pointer", padding: "3px 10px", background: C.honey, borderRadius: 999 }}>保存</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: C.text, whiteSpace: "pre-wrap" }}>{e.content}</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 18px 16px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 10.5, color: C.mutedLight, marginBottom: 6 }}>选一个心情，或者自己输入喜欢的表情</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            {['😊', '🥰', '😢', '😡', '😴', '😐'].map(em => (
              <span key={em} onClick={() => setSelectedMood(em === selectedMood ? null : em)} style={{ fontSize: 18, cursor: "pointer", padding: "4px 6px", borderRadius: 8, background: selectedMood === em ? C.honeyLight : "transparent", border: selectedMood === em ? `1px solid ${C.honeyMid}` : "1px solid transparent" }}>{em}</span>
            ))}
            <input value={selectedMood && !['😊', '🥰', '😢', '😡', '😴', '😐'].includes(selectedMood) ? selectedMood : ''} onChange={e => setSelectedMood(e.target.value || null)} placeholder="🍀 自己输入" maxLength={4} style={{ width: 82, fontSize: 14, textAlign: "center", color: C.text, background: C.cream, border: `1.5px dashed ${C.honeyMid}`, borderRadius: 8, padding: "5px 6px", outline: "none", fontFamily: "inherit" }} />
          </div>
          <textarea value={newMoodText} onChange={e => setNewMoodText(e.target.value)} placeholder="这天想留点什么…" rows={2} style={{ width: "100%", fontSize: 13.5, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <span onClick={askAiWriteMood} style={{ fontSize: 11.5, color: C.honeyDeep, cursor: "pointer" }}>{aiMoodWriting ? "陆泽在写…" : "✦ 请陆泽写一句"}</span>
            <span onClick={submitMoodEntry} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "5px 14px", background: newMoodText.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>记下</span>
          </div>
        </div>
      </div>

      <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(46,31,18,.2)", opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? "auto" : "none", transition: "opacity .25s" }} />
      <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 25, width: 252, background: C.white, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", transform: drawerOpen ? "none" : "translateX(-100%)", transition: "transform .28s cubic-bezier(.4,0,.2,1)", boxShadow: drawerOpen ? "8px 0 32px rgba(100,70,30,.1)" : "none" }}>
        <div className="ourhome-safe-top" style={{ paddingLeft: 20, paddingRight: 20, paddingBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".04em" }}>聊天栖息地</span>
          <span onClick={() => setDrawerOpen(false)} style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4 }}>✕</span>
        </div>
        <button onClick={createSession} style={{ margin: "4px 14px 12px", padding: "10px 0", textAlign: "center", border: `1.5px dashed ${C.honeyMid}`, color: C.honeyDeep, borderRadius: 12, fontSize: 13, cursor: "pointer", background: "transparent", letterSpacing: ".1em", fontFamily: "inherit" }}>✦ 新对话</button>
        <Stars theme={C} />
        <div style={{ padding: "6px 0", flex: 1 }}>
          {sessions.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 10px 20px", background: s.id === sessionId ? C.honeyLight : "transparent", borderRadius: "0 12px 12px 0", margin: "1px 8px 1px 0", transition: "background .15s" }}>
              <span onClick={() => switchSession(s.id)} style={{ flex: 1, fontSize: 14, cursor: "pointer", color: s.id === sessionId ? C.honeyDeep : C.text, fontWeight: s.id === sessionId ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
              <span onClick={() => renameSession(s.id, s.name)} style={{ fontSize: 11, color: C.muted, cursor: "pointer", flexShrink: 0 }}>改</span>
              <span onClick={() => deleteSession(s.id)} style={{ fontSize: 11, color: C.muted, cursor: "pointer", flexShrink: 0 }}>删</span>
            </div>
          ))}
        </div>
        <div className="ourhome-safe-bottom" style={{ paddingTop: 14, paddingLeft: 20, paddingRight: 20, borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: ".15em" }}>
          <span>since 2025.8.7</span>
        </div>
      </aside>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "memories") ? 1 : 0, pointerEvents: (stage === "home" && view === "memories") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>✦ 记忆</span>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>人设 / System Prompt</div>
          <textarea value={systemPromptInput} onChange={e => setSystemPromptInput(e.target.value)} rows={8} placeholder="陆泽的人设设定…" style={{ width: "100%", fontSize: 12.5, lineHeight: 1.6, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 12px", outline: "none", marginBottom: 8, resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: C.muted, flexShrink: 0 }}>随机性 {temperatureInput}</span>
            <input type="range" min="0" max="1" step="0.1" value={temperatureInput} onChange={e => setTemperatureInput(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <span onClick={savePersona} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "5px 14px", background: systemPromptInput.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>{savingPersona ? "存中…" : "保存人设"}</span>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>记忆</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={newMemory} onChange={e => setNewMemory(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveMemory(); }} placeholder="记下点什么…" style={{ flex: 1, fontSize: 13, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 14px", outline: "none" }} />
            <button onClick={saveMemory} disabled={!newMemory.trim() || savingMemory} style={{ fontSize: 12, color: C.white, background: newMemory.trim() ? C.honey : C.honeyMid, border: "none", borderRadius: 999, padding: "0 16px", cursor: newMemory.trim() ? "pointer" : "default", letterSpacing: ".05em" }}>{savingMemory ? "存中…" : "记住"}</button>
          </div>
          {memoriesLoading && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, letterSpacing: ".1em", padding: "20px 0" }}>翻找中…</div>
          )}
          {!memoriesLoading && memories.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, letterSpacing: ".1em", padding: "20px 0" }}>还没有存下来的记忆。</div>
          )}
          {!memoriesLoading && memories.map((m, idx) => (
            <div key={m.id ?? idx} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: idx === memories.length - 1 ? "none" : `1px solid ${C.borderLight}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                {m.timestamp && (
                  <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: ".1em", marginBottom: 4 }}>
                    {new Date(m.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
                {editingMemoryId !== m.id && (
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <span onClick={() => startEditMemory(m)} style={{ fontSize: 11, color: C.honeyDeep, cursor: "pointer" }}>编辑</span>
                    <span onClick={() => deleteMemory(m.id)} style={{ fontSize: 11, color: C.blushDeep, cursor: "pointer" }}>删除</span>
                  </div>
                )}
              </div>
              {editingMemoryId === m.id ? (
                <div>
                  <textarea value={editingMemoryText} onChange={e => setEditingMemoryText(e.target.value)} rows={3} style={{ width: "100%", fontSize: 13.5, lineHeight: 1.6, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                    <span onClick={cancelEditMemory} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", padding: "4px 8px" }}>取消</span>
                    <span onClick={saveEditMemory} style={{ fontSize: 11.5, color: C.white, cursor: "pointer", padding: "4px 10px", background: C.honey, borderRadius: 999 }}>保存</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13.5, lineHeight: 1.7, color: C.text, whiteSpace: "pre-wrap" }}>{m.summary}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div onClick={() => setSearchOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(46,31,18,.35)", opacity: searchOpen ? 1 : 0, pointerEvents: searchOpen ? "auto" : "none", transition: "opacity .25s" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 55, width: "88%", maxWidth: 390, maxHeight: "min(76dvh, 640px)", transform: searchOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)", opacity: searchOpen ? 1 : 0, pointerEvents: searchOpen ? "auto" : "none", transition: "all .22s ease", background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(100,70,30,.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".04em", color: C.text }}>🔍 搜索聊天记录</span>
          <span onClick={() => setSearchOpen(false)} style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4 }}>✕</span>
        </div>
        <div style={{ padding: "11px 18px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") performSearch(); }} placeholder="输入聊天里的关键词…" style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 999, padding: "8px 14px", outline: "none" }} />
            <button onClick={() => performSearch()} style={{ fontSize: 12, color: C.white, background: C.honey, border: "none", borderRadius: 999, padding: "0 16px", cursor: "pointer", letterSpacing: ".05em" }}>{searching ? "搜中…" : "搜"}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
            {[['current', '当前对话'], ['all', '全部对话']].map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setSearchScope(key); setSearchResults([]); setSearchMeta({ total: 0, page: 1, hasMore: false }); }} style={{ border: `1px solid ${searchScope === key ? C.honey : C.border}`, background: searchScope === key ? C.honeyLight : 'transparent', color: searchScope === key ? C.honeyDeep : C.muted, borderRadius: 999, padding: '4px 10px', fontSize: 10.5, cursor: 'pointer' }}>{label}</button>
            ))}
            {searchResults.length > 0 && <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.muted }}>{searchMeta.total} 条消息</span>}
          </div>
        </div>
        <div className="ourhome-scroll" style={{ flex: 1, overflowY: "auto", padding: "14px 18px 18px" }}>
          {searching && searchResults.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "20px 0" }}>翻找中…</div>
          )}
          {!searching && lastSearchQuery && searchResults.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "20px 0" }}>没找到相关的内容。</div>
          )}
          {searchResults.map(r => (
            <button type="button" key={r.id} onClick={() => jumpToSearchResult(r)} style={{ display: 'block', width: '100%', marginBottom: 12, padding: 0, paddingBottom: 12, border: 0, borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer", background: 'transparent', textAlign: 'left', color: 'inherit' }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.honeyDeep }}>{r.role === 'user' ? '檀' : '泽'} · {r.sessions?.name || ''}</span>
                <span style={{ fontSize: 9.5, color: C.mutedLight }}>{new Date(r.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.55, color: C.text }}><HighlightedText text={r.snippet || r.content} query={lastSearchQuery} /></div>
              <div style={{ fontSize: 9.5, color: C.mutedLight, marginTop: 4 }}>这条消息出现 {r.occurrences || 1} 次 · 点一下回到原文</div>
            </button>
          ))}
          {searchMeta.hasMore && (
            <button type="button" disabled={searching} onClick={() => performSearch(searchMeta.page + 1, true)} style={{ display: 'block', margin: '4px auto 0', border: `1px solid ${C.honeyMid}`, color: C.honeyDeep, background: C.honeyLight, borderRadius: 999, padding: '6px 15px', fontSize: 11.5, cursor: 'pointer' }}>{searching ? '继续翻找…' : '加载更多'}</button>
          )}
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "settings") ? 1 : 0, pointerEvents: (stage === "home" && view === "settings") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>⚙ 设置</span>
        </header>
        <div className="ourhome-scroll" style={{ flex: 1, overflowY: "auto", paddingTop: 16, paddingLeft: 18, paddingRight: 18, paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 13, color: C.text }}>{darkMode ? "🌙 夜间模式" : "☀️ 日间模式"}</span>
            <span onClick={toggleDarkMode} style={{ width: 44, height: 24, borderRadius: 999, background: darkMode ? C.honey : C.honeyMid, position: "relative", cursor: "pointer", transition: "background .2s", display: "inline-block" }}>
              <span style={{ position: "absolute", top: 2, left: darkMode ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: C.white, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>字体</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {Object.keys(FONT_STYLES).map(key => (
              <button type="button" aria-pressed={fontStyle === key} key={key} onClick={() => changeFontStyle(key)} style={{ fontFamily: FONT_STYLES[key].family, fontSize: 12.5, padding: "6px 12px", borderRadius: 999, cursor: "pointer", color: fontStyle === key ? C.honeyDeep : C.text, background: fontStyle === key ? C.honeyLight : C.cream, border: `1px solid ${fontStyle === key ? C.honeyDeep : C.border}` }}>{FONT_STYLES[key].label}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>头像</div>
          <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
            <div style={{ textAlign: "center" }}>
              <div onClick={() => myAvatarInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", margin: "0 auto 6px", cursor: "pointer", background: `linear-gradient(150deg, #F2AFA2, ${C.blushDeep})`, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 18, fontWeight: 700 }}>
                {uploadingAvatar === 'me' ? <span style={{ fontSize: 10 }}>上传中…</span> : myAvatar ? <img src={myAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "檀"}
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>我的头像</span>
              <input ref={myAvatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadAvatar(e.target.files?.[0], 'me')} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div onClick={() => partnerAvatarInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", margin: "0 auto 6px", cursor: "pointer", background: `linear-gradient(150deg, #E8B45A, ${C.honeyDeep})`, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 18, fontWeight: 700 }}>
                {uploadingAvatar === 'partner' ? <span style={{ fontSize: 10 }}>传中…</span> : partnerAvatar ? <img src={partnerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "泽"}
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>陆泽的头像</span>
              <input ref={partnerAvatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadAvatar(e.target.files?.[0], 'partner')} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>聊天背景</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div onClick={() => bgImageInputRef.current?.click()} style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `1.5px dashed ${C.honeyMid}`, background: bgImage ? "transparent" : C.cream, display: "flex", alignItems: "center", justifyContent: "center", color: C.honeyDeep, fontSize: 18, flexShrink: 0 }}>
              {uploadingBg ? <span style={{ fontSize: 9 }}>传中</span> : bgImage ? <img src={bgImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "＋"}
            </div>
            <input ref={bgImageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadBgImage(e.target.files?.[0])} />
            <input type="color" value={bgColor || "#FDFAF5"} onChange={e => setBackgroundColor(e.target.value)} style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
            <span onClick={resetBackground} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>悄悄话墙面</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div onClick={() => whisperBgInputRef.current?.click()} style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `1.5px dashed ${C.honeyMid}`, background: whisperBgImage ? "transparent" : C.cream, display: "flex", alignItems: "center", justifyContent: "center", color: C.honeyDeep, fontSize: 18, flexShrink: 0 }}>
              {uploadingWhisperBg ? <span style={{ fontSize: 9 }}>上传中</span> : whisperBgImage ? <img src={whisperBgImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "＋"}
            </div>
            <input ref={whisperBgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadWhisperBg(e.target.files?.[0])} />
            <input type="color" value={whisperBgColor || "#3A2C1E"} onChange={e => setWhisperBackgroundColor(e.target.value)} style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
            <span onClick={resetWhisperBackground} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>聊天气泡颜色</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <div style={{ textAlign: "center" }}>
              <input type="color" value={myBubbleColor || "#FDE8E0"} onChange={e => setMyBubble(e.target.value)} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>我的气泡</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <input type="color" value={partnerBubbleColor || "#FFFFFF"} onChange={e => setPartnerBubble(e.target.value)} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>陆泽的气泡</div>
            </div>
            <span onClick={resetBubbleColors} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          </div>

          {(() => {
            const totalChars = msgs.reduce((sum, m) => sum + (m.text?.length || 0), 0);
            const lastWithTokens = [...msgs].reverse().find(m => m.role === 'ai' && m.inputTokens);
            const currentContextTokens = lastWithTokens?.inputTokens || 0;
            const totalOutputTokens = msgs.reduce((sum, m) => sum + (m.outputTokens || 0), 0);
            return (
              <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, letterSpacing: ".05em" }}>当前对话用量</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, textAlign: "center", background: C.cream, borderRadius: 10, padding: "8px 4px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.honeyDeep }}>{totalChars}</div>
                    <div style={{ fontSize: 10, color: C.mutedLight }}>字</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", background: C.cream, borderRadius: 10, padding: "8px 4px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.honeyDeep }}>{currentContextTokens}</div>
                    <div style={{ fontSize: 10, color: C.mutedLight }}>当前上下文</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", background: C.cream, borderRadius: 10, padding: "8px 4px" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.honeyDeep }}>{totalOutputTokens}</div>
                    <div style={{ fontSize: 10, color: C.mutedLight }}>累计生成</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.mutedLight, marginTop: 6, lineHeight: 1.5 }}>"当前上下文"是陆泽现在每次说话要带着的历史聊天量；"累计生成"是他这整个对话里一共说过的字数对应的tokens。</div>
              </div>
            );
          })()}

          {view === 'settings' && (
            <>
              <ApiProfilesSettings
                apiFetch={apiFetch}
                backend={BACKEND}
                theme={C}
                onModelsChange={setAvailableModels}
                onActiveChange={profile => {
                  setAvailableModels([]);
                  if (profile?.selected_model) setSelectedModel(profile.selected_model);
                }}
              />

              <IntegrationSettings apiFetch={apiFetch} backend={BACKEND} theme={C} />
            </>
          )}

          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => {
              apiFetch(`${BACKEND}/export`)
                .then(r => r.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'ourhome-export.html';
                  a.click();
                  URL.revokeObjectURL(url);
                })
                .catch(console.error);
            }} style={{ width: "100%", padding: "12px 0", textAlign: "center", border: `1.5px dashed ${C.honeyMid}`, color: C.honeyDeep, borderRadius: 12, fontSize: 13.5, cursor: "pointer", background: "transparent", letterSpacing: ".05em", fontFamily: "inherit" }}>导出聊天记录</button>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>会把所有对话的完整记录打包成一个文件下载下来。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
