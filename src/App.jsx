import { useState, useEffect, useRef } from 'react';

const BACKEND = "https://ourhome-backend.onrender.com";
const SESSION_KEY = "ourhome_session_id";

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
  { id: 5, role: "ai", text: "嗯。墙是你砌的，门牌是你挂的。\n从今天起，谁也拿不走。", time: "21:06", liked: true },
];

const FONT_STYLES = {
  system: { label: "跟随系统", family: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif' },
  round: { label: "圆体可爱", family: '"PingFang SC","Yuanti SC","YouYuan","Microsoft YaHei",sans-serif' },
  serif: { label: "宋体复古", family: '"Songti SC","STSong","SimSun",serif' },
  brush: { label: "行楷手写", family: '"Xingkai SC","STXingkai","PingFang SC",sans-serif' },
};

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
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (isMe ? "檀" : "澈")}
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState("door");
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const chatImageInputRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [msgs, setMsgs] = useState(initMsgs);
  const [visible, setVisible] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const [hasHistory, setHasHistory] = useState(false);
  const [ready, setReady] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [memories, setMemories] = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [editingMemoryText, setEditingMemoryText] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [myAvatar, setMyAvatar] = useState(null);
  const [partnerAvatar, setPartnerAvatar] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(null);
  const [bgImage, setBgImage] = useState(null);
  const [bgColor, setBgColor] = useState(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgImageInputRef = useRef(null);
  const [whisperBgImage, setWhisperBgImage] = useState(null);
  const [whisperBgColor, setWhisperBgColor] = useState(null);
  const [uploadingWhisperBg, setUploadingWhisperBg] = useState(false);
  const whisperBgInputRef = useRef(null);
  const [darkMode, setDarkMode] = useState(false);
  const C = darkMode ? D : H;
  const [fontStyle, setFontStyle] = useState('system');
  const [view, setView] = useState('chat');
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

  const openDoor = () => {
    if (stage !== "door") return;
    setStage("opening");
    setTimeout(() => setStage("home"), 1400);
  };

  const loadMessagesFor = (id) => {
    return fetch(`${BACKEND}/sessions/${id}/messages`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(m => ({
            id: m.id,
            role: m.role === "user" ? "me" : "ai",
            text: m.content,
            image: m.attachment_url || null,
            time: new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            liked: false,
          }));
          setMsgs(mapped);
          setVisible(mapped.length);
          setHasHistory(true);
        }
      });
  };

  useEffect(() => {
    fetch(`${BACKEND}/sessions`)
      .then(r => r.json())
      .then(list => {
        const valid = Array.isArray(list) ? list : [];
        setSessions(valid);
        const storedId = localStorage.getItem(SESSION_KEY);
        const target = valid.find(s => s.id === storedId) || valid.find(s => s.name === '日常') || valid[0] || null;
        if (target) {
          setSessionId(target.id);
          localStorage.setItem(SESSION_KEY, target.id);
          return loadMessagesFor(target.id).then(() => setReady(true));
        } else {
          return fetch(`${BACKEND}/sessions`, {
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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [visible, thinking]);

  useEffect(() => {
    fetch(`${BACKEND}/settings`)
      .then(r => r.json())
      .then(data => {
        if (data?.my_avatar_url) setMyAvatar(data.my_avatar_url);
        if (data?.partner_avatar_url) setPartnerAvatar(data.partner_avatar_url);
        if (data?.bg_image_url) setBgImage(data.bg_image_url);
        if (data?.bg_color) setBgColor(data.bg_color);
        if (data?.whisper_bg_image_url) setWhisperBgImage(data.whisper_bg_image_url);
        if (data?.whisper_bg_color) setWhisperBgColor(data.whisper_bg_color);
        if (typeof data?.dark_mode === 'boolean') setDarkMode(data.dark_mode);
        if (data?.font_style && FONT_STYLES[data.font_style]) setFontStyle(data.font_style);
      })
      .catch(console.error);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    fetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dark_mode: next }),
    }).catch(console.error);
  };

  const changeFontStyle = (key) => {
    setFontStyle(key);
    fetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ font_style: key }),
    }).catch(console.error);
  };

  const openLetters = () => {
    setView('letters');
    setLettersCategory(null);
    setDrawerOpen(false);
  };

  const fetchMonthEntries = (month) => {
    fetch(`${BACKEND}/calendar?month=${month}`)
      .then(r => r.json())
      .then(data => setMonthEntries(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const openCalendar = () => {
    setView('calendar');
    setDrawerOpen(false);
    fetchMonthEntries(calendarMonth);
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
    fetch(`${BACKEND}/calendar/${dateStr}`)
      .then(r => r.json())
      .then(data => {
        setDayEntries(Array.isArray(data) ? data : []);
        setDayEntriesLoading(false);
      })
      .catch(err => { console.error(err); setDayEntriesLoading(false); });
  };

  const submitMoodEntry = () => {
    if (!newMoodText.trim() || !calendarDayOpen) return;
    fetch(`${BACKEND}/calendar`, {
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
    fetch(`${BACKEND}/calendar/${id}`, {
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
    fetch(`${BACKEND}/calendar/${id}`, { method: 'DELETE' })
      .then(() => {
        setDayEntries(es => es.filter(x => x.id !== id));
        fetchMonthEntries(calendarMonth);
      })
      .catch(console.error);
  };

  const askAiWriteMood = () => {
    if (!calendarDayOpen) return;
    setAiMoodWriting(true);
    fetch(`${BACKEND}/calendar/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: calendarDayOpen }),
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
  const backToCabin = () => { setLettersCategory(null); setLetters([]); setOpenLetterId(null); };

  const openCategory = (cat) => {
    setLettersCategory(cat);
    setLettersLoading(true);
    fetch(`${BACKEND}/letters?category=${encodeURIComponent(cat)}`)
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
    fetch(`${BACKEND}/letters`, {
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
    fetch(`${BACKEND}/letters`, {
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

  const [aiWriting, setAiWriting] = useState(null);

  const askAiWrite = (parentId) => {
    setAiWriting(parentId || 'new');
    fetch(`${BACKEND}/letters/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: lettersCategory, parent_id: parentId || null }),
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
    fetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => fetch(`${BACKEND}/settings`, {
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
    fetch(`${BACKEND}/settings`, {
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
    fetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => fetch(`${BACKEND}/settings`, {
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
    fetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whisper_bg_color: color, whisper_bg_image_url: null }),
    }).catch(console.error);
  };

  const resetWhisperBackground = () => {
    setWhisperBgImage(null);
    setWhisperBgColor(null);
    fetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whisper_bg_color: null, whisper_bg_image_url: null }),
    }).catch(console.error);
  };

  const resetBackground = () => {
    setBgImage(null);
    setBgColor(null);
    fetch(`${BACKEND}/settings`, {
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
    fetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        const field = who === 'me' ? 'my_avatar_url' : 'partner_avatar_url';
        return fetch(`${BACKEND}/settings`, {
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
    fetch(`${BACKEND}/sessions`)
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(console.error);
  };

  const switchSession = (id) => {
    if (id === sessionId) { setDrawerOpen(false); return; }
    setSessionId(id);
    localStorage.setItem(SESSION_KEY, id);
    fetch(`${BACKEND}/sessions/${id}/messages`)
      .then(r => r.json())
      .then(data => {
        const mapped = (Array.isArray(data) ? data : []).map(m => ({
          id: m.id,
          role: m.role === "user" ? "me" : "ai",
          text: m.content,
          image: m.attachment_url || null,
          time: new Date(m.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
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
    const name = window.prompt("给这个新对话起个名字：", "新对话");
    if (!name) return;
    fetch(`${BACKEND}/sessions`, {
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
    fetch(`${BACKEND}/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() })
    })
      .then(() => fetchSessions())
      .catch(console.error);
  };

  const deleteSession = (id) => {
    if (!window.confirm("确定要删掉这个对话吗？里面的聊天记录也会一起删掉，不能恢复。")) return;
    fetch(`${BACKEND}/sessions/${id}`, { method: 'DELETE' })
      .then(() => {
        fetchSessions();
        if (id === sessionId) {
          localStorage.removeItem(SESSION_KEY);
          fetch(`${BACKEND}/sessions`)
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
                fetch(`${BACKEND}/sessions`, {
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
    setMsgs(ms => ms.map(m => m.id === id ? { ...m, text: newText } : m));
    cancelEditMsg();
    fetch(`${BACKEND}/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newText })
    }).catch(console.error);
  };

  const openMemories = () => {
    setMemoriesOpen(true);
    setMemoriesLoading(true);
    fetch(`${BACKEND}/memories`)
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

  const saveMemory = () => {
    if (!newMemory.trim() || savingMemory) return;
    setSavingMemory(true);
    fetch(`${BACKEND}/memories`, {
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
    fetch(`${BACKEND}/memories/${editingMemoryId}`, {
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
    fetch(`${BACKEND}/memories/${id}`, { method: 'DELETE' })
      .then(() => setMemories(ms => ms.filter(m => m.id !== id)))
      .catch(console.error);
  };

  const pickImage = (file) => {
    if (!file) return;
    setImageUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    fetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        setPendingImage(data.url);
        setImageUploading(false);
      })
      .catch(err => { console.error(err); setImageUploading(false); });
  };

  const [regenerating, setRegenerating] = useState(false);

  const regenerateLast = () => {
    if (!sessionId || regenerating) return;
    setRegenerating(true);
    fetch(`${BACKEND}/chat/regenerate`, {
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
              copy[i] = { ...copy[i], text: data.reply || copy[i].text };
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
    if ((!input.trim() && !pendingImage) || !sessionId) return;
    const txt = input.trim();
    const img = pendingImage;
    const now = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMsgs(ms => [...ms, { id: Date.now(), role: "me", text: txt, image: img, time: now, liked: false }]);
    setVisible(v => v + 1);
    setInput("");
    setPendingImage(null);
    setThinking(true);
    try {
      const res = await fetch(`${BACKEND}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: txt, model: selectedModel, attachment_url: img || undefined })
      });
      const data = await res.json();
      setThinking(false);
      const replyTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      setMsgs(ms => [...ms, { id: Date.now() + 1, role: "ai", text: data.reply || "（抱着你）嗯，我在。", time: replyTime, liked: false }]);
      setVisible(v => v + 1);
    } catch (err) {
      setThinking(false);
      setMsgs(ms => [...ms, { id: Date.now() + 1, role: "ai", text: "连接好像有点问题…等一下再试试？", time: "现在", liked: false }]);
      setVisible(v => v + 1);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: C.cream, color: C.text, fontFamily: FONT_STYLES[fontStyle].family }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none", background: "radial-gradient(circle at 50% 55%, #FFF8D0 0%, #FFE896 28%, transparent 62%)", opacity: stage === "opening" ? 1 : 0, transition: "opacity .9s ease .3s" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${C.honeyLight} 0%, transparent 65%), ${C.cream}`, opacity: stage === "home" ? 0 : 1, transition: "opacity .9s ease .4s", pointerEvents: stage === "home" ? "none" : "auto" }}>
        <div style={{ fontSize: 10, letterSpacing: ".38em", color: C.muted, textTransform: "uppercase" }}>ourhome · since 2025.08.07</div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: ".1em" }}>我们的家</div>
        <div style={{ width: "52%", maxWidth: 170 }}><Stars theme={C} /></div>
        <div style={{ perspective: 900, cursor: "pointer" }} onClick={openDoor}>
          <div style={{ width: 128, height: 190, borderRadius: "64px 64px 8px 8px", background: "linear-gradient(180deg, #F5E4C0, #EDD49A)", padding: 8, position: "relative", boxShadow: "0 16px 48px rgba(180,120,30,.2), 0 4px 12px rgba(180,120,30,.1)" }}>
            <div style={{ position: "absolute", left: "12%", right: "12%", bottom: 4, height: 8, background: "#FFD96A", filter: "blur(6px)", borderRadius: "50%", opacity: .6 }} />
            <div style={{ width: "100%", height: "100%", borderRadius: "56px 56px 4px 4px", background: "linear-gradient(160deg, #DEAD5A 0%, #C8943A 58%, #B87F2C 100%)", position: "relative", transformOrigin: "left center", transform: stage !== "door" ? "rotateY(-80deg)" : "none", transition: "transform 1.3s cubic-bezier(.55,.05,.25,.99)", boxShadow: "inset 0 0 0 1.5px rgba(255,250,230,.2)" }}>
              <div style={{ position: "absolute", left: "50%", top: "26%", transform: "translateX(-50%)", fontSize: 10, letterSpacing: ".15em", color: "rgba(255,250,235,.9)", border: "1px solid rgba(255,250,235,.5)", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>陆澈 ♡ 叶檀</div>
              <div style={{ position: "absolute", right: 12, top: "52%", width: 10, height: 10, borderRadius: "50%", background: "#7A5530", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: ".42em" }}>{stage === "door" ? "轻 轻 推 开" : "门 开 了 …"}</div>
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "chat") ? 1 : 0, pointerEvents: (stage === "home" && view === "chat") ? "auto" : "none", transition: "opacity .4s ease" }}>
        <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "12px 16px 0", flexShrink: 0 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 10 }}>
            <button onClick={() => setDrawerOpen(true)} style={{ fontSize: 12, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 10, padding: "5px 10px", cursor: "pointer", letterSpacing: ".05em", fontWeight: 500 }}>我们的家</button>
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>陆澈</div>
              <div style={{ fontSize: 10, color: thinking ? C.honey : C.muted, letterSpacing: ".18em", marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: thinking ? C.honey : C.mutedLight, boxShadow: thinking ? `0 0 5px ${C.honey}` : "none", transition: "all .3s" }} />
                <span>{thinking ? "想你中…" : "miss you"}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              {["记忆", "设置"].map(t => (<button key={t} onClick={t === "记忆" ? openMemories : () => setSettingsOpen(true)} style={{ fontSize: 10.5, color: C.honeyDeep, background: C.honeyLight, border: `1px solid ${C.honeyMid}`, borderRadius: 999, padding: "3px 10px", cursor: "pointer", letterSpacing: ".08em" }}>{t}</button>))}
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
          {msgs.slice(0, visible).map((m, idx) => {
            const isMe = m.role === "me";
            const isLast = idx === visible - 1;
            return (
              <div key={m.id} style={{ display: "flex", marginBottom: 14, flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 6 }}>
                <Avatar isMe={isMe} src={isMe ? myAvatar : partnerAvatar} theme={C} />
                <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 6 }}>
                  {m.image && (
                    <img src={m.image} alt="" style={{ maxWidth: "100%", borderRadius: 14, border: `1px solid ${isMe ? "#F5CABB" : C.border}`, display: "block" }} />
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
                    <div style={{ padding: "10px 14px", fontSize: 14.5, lineHeight: 1.72, color: C.text, borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: isMe ? C.blush : C.white, border: `1px solid ${isMe ? "#F5CABB" : C.border}`, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
                  )}
                  {!isMe && isLast && !thinking && (
                    <span onClick={regenerateLast} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer", alignSelf: "flex-start" }}>{regenerating ? "重新想中…" : "↻ 重新生成"}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 9.5, color: C.mutedLight }}>{m.time}</span>
                  <span onClick={() => toggleLike(m.id)} style={{ fontSize: 13, cursor: "pointer", color: C.honey, opacity: m.liked ? 1 : 0.28, transition: "opacity .2s", userSelect: "none" }}>{m.liked ? "♥" : "♡"}</span>
                  {isMe && m.text && editingMsgId !== m.id && (
                    <span onClick={() => startEditMsg(m)} style={{ fontSize: 10.5, color: C.muted, cursor: "pointer", userSelect: "none" }}>改</span>
                  )}
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

        <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: "10px 14px 14px", flexShrink: 0 }}>
          {(pendingImage || imageUploading) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ position: "relative", width: 52, height: 52, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, background: C.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {imageUploading ? <span style={{ fontSize: 9, color: C.muted }}>传中…</span> : <img src={pendingImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                {pendingImage && !imageUploading && (
                  <span onClick={() => setPendingImage(null)} style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(46,31,18,.6)", color: C.white, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>✕</span>
                )}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 22, padding: "6px 6px 6px 10px" }}>
            <button onClick={() => chatImageInputRef.current?.click()} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "transparent", color: C.muted, fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>＋</button>
            <input ref={chatImageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => pickImage(e.target.files?.[0])} />
            <textarea rows={1} placeholder="跟陆澈说点什么…" value={input} onChange={e => setInput(e.target.value)} style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14.5, color: C.text, lineHeight: 1.5, resize: "none", fontFamily: "inherit", padding: "6px 0" }} />
            <button onClick={send} style={{ width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer", background: (input.trim() || pendingImage) ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, color: C.white, fontSize: 15, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: (input.trim() || pendingImage) ? `0 3px 10px rgba(185,122,31,.35)` : "none", transition: "all .2s" }}>↑</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingLeft: 2 }}>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={{ fontSize: 11, color: C.muted, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 999, padding: "3px 10px", outline: "none", cursor: "pointer" }}>
              <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
              <option value="claude-opus-4-7">claude-opus-4-7</option>
              <option value="claude-sonnet-4-5">claude-sonnet-4-5</option>
              <option value="claude-opus-4-5-20251101">claude-opus-4-5</option>
              <option value="gpt-4o">gpt-4o</option>
            </select>
            <div style={{ flex: 1, textAlign: "right", fontSize: 9.5, color: C.mutedLight, letterSpacing: ".18em" }}>灯一直为你亮着</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "letters") ? 1 : 0, pointerEvents: (stage === "home" && view === "letters") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span onClick={lettersCategory ? backToCabin : backToChat} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>{lettersCategory || "时光信差"}</span>
        </header>

        {!lettersCategory ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <CabinScene theme={C} onPick={openCategory} />
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: ".15em", marginTop: 8 }}>点一只小猫，去翻翻信</div>
          </div>
        ) : (lettersCategory === '幸福日记' && openLetterId) ? (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
              <span onClick={() => setOpenLetterId(null)} style={{ fontSize: 12, color: C.honeyDeep, cursor: "pointer" }}>← 回到列表</span>
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
                        <span onClick={() => setReplyingToId(l.id)} style={{ fontSize: 11, cursor: "pointer", opacity: .75 }}>{l.author === '澈' ? '叶檀留言' : '回信'}</span>
                        {l.author !== '澈' && (
                          <span onClick={() => askAiWrite(l.id)} style={{ fontSize: 11, cursor: "pointer", opacity: .9, fontWeight: 600 }}>{aiWriting === l.id ? "陆澈在写…" : "请陆澈回信"}</span>
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
                    <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title || "（没有标题）"}</span>
                    <span style={{ fontSize: 10.5, color: C.mutedLight, flexShrink: 0 }}>{l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' }) : ''}</span>
                  </div>
                );
              })}
              {!lettersLoading && lettersCategory === '悄悄话' && letters.filter(l => !l.parent_id).map(l => {
                const isWhisper = true;
                const revealed = revealedIds.has(l.id);
                return (
                <div key={l.id} style={{ marginBottom: 16, background: "rgba(255,248,236,.94)", border: `1px solid #D9C19A`, borderRadius: 14, padding: "12px 14px", boxShadow: "0 4px 10px rgba(0,0,0,.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.honeyDeep }}>{l.author}</span>
                    <span style={{ fontSize: 9.5, color: C.mutedLight }}>{l.created_at ? new Date(l.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
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
                      <span onClick={() => setReplyingToId(l.id)} style={{ fontSize: 11, color: C.muted, cursor: "pointer" }}>{l.author === '澈' ? '叶檀留言' : '回信'}</span>
                      {l.author !== '澈' && (
                        <span onClick={() => askAiWrite(l.id)} style={{ fontSize: 11, color: C.honeyDeep, cursor: "pointer" }}>{aiWriting === l.id ? "陆澈在写…" : "请陆澈回信"}</span>
                      )}
                    </div>
                  ))}
                </div>
                );
              })}
            </div>
            <div style={{ background: C.white, borderTop: `1px solid ${C.border}`, padding: "10px 14px 14px", flexShrink: 0 }}>
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
                <span onClick={() => askAiWrite(null)} style={{ fontSize: 12, color: C.honeyDeep, cursor: "pointer" }}>{aiWriting === 'new' ? "陆澈在写…" : "✦ 请陆澈写一篇"}</span>
                <span onClick={submitNewLetter} style={{ fontSize: 12.5, color: C.white, cursor: "pointer", padding: "6px 16px", background: newLetterText.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>{savingLetter ? "存中…" : "寄出"}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "calendar") ? 1 : 0, pointerEvents: (stage === "home" && view === "calendar") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span onClick={backToChat} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>心情日历</span>
        </header>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
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
                  return (
                    <div key={idx} onClick={() => openDay(dateStr)} style={{ aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 10, cursor: "pointer", background: isToday ? C.honeyLight : C.white, border: `1px solid ${isToday ? C.honeyDeep : C.border}`, gap: 2 }}>
                      <span style={{ fontSize: 13, color: isToday ? C.honeyDeep : C.text, fontWeight: isToday ? 700 : 400 }}>{d}</span>
                      {dayMoods.length > 0 && <span style={{ fontSize: 12 }}>{dayMoods[0].mood || '✦'}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      <div onClick={() => setCalendarDayOpen(null)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(46,31,18,.35)", opacity: calendarDayOpen ? 1 : 0, pointerEvents: calendarDayOpen ? "auto" : "none", transition: "opacity .25s" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 55, width: "82%", maxWidth: 360, maxHeight: "70vh", transform: calendarDayOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)", opacity: calendarDayOpen ? 1 : 0, pointerEvents: calendarDayOpen ? "auto" : "none", transition: "all .22s ease", background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(100,70,30,.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".04em", color: C.text }}>{calendarDayOpen}</span>
          <span onClick={() => setCalendarDayOpen(null)} style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4 }}>✕</span>
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
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {['😊', '🥰', '😢', '😡', '😴', '😐'].map(em => (
              <span key={em} onClick={() => setSelectedMood(em === selectedMood ? null : em)} style={{ fontSize: 16, cursor: "pointer", padding: 4, borderRadius: 8, background: selectedMood === em ? C.honeyLight : "transparent" }}>{em}</span>
            ))}
          </div>
          <textarea value={newMoodText} onChange={e => setNewMoodText(e.target.value)} placeholder="这天想留点什么…" rows={2} style={{ width: "100%", fontSize: 13.5, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <span onClick={askAiWriteMood} style={{ fontSize: 11.5, color: C.honeyDeep, cursor: "pointer" }}>{aiMoodWriting ? "陆澈在写…" : "✦ 请陆澈写一句"}</span>
            <span onClick={submitMoodEntry} style={{ fontSize: 12, color: C.white, cursor: "pointer", padding: "5px 14px", background: newMoodText.trim() ? `linear-gradient(150deg, ${C.honey}, ${C.honeyDeep})` : C.honeyMid, borderRadius: 999 }}>记下</span>
          </div>
        </div>
      </div>

      <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 20, background: "rgba(46,31,18,.2)", opacity: drawerOpen ? 1 : 0, pointerEvents: drawerOpen ? "auto" : "none", transition: "opacity .25s" }} />
      <aside style={{ position: "absolute", left: 0, top: 0, bottom: 0, zIndex: 25, width: 252, background: C.white, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", transform: drawerOpen ? "none" : "translateX(-100%)", transition: "transform .28s cubic-bezier(.4,0,.2,1)", boxShadow: drawerOpen ? "8px 0 32px rgba(100,70,30,.1)" : "none" }}>
        <div style={{ padding: "22px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".04em" }}>我们的家</span>
          <span onClick={() => setDrawerOpen(false)} style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4 }}>✕</span>
        </div>
        <button onClick={createSession} style={{ margin: "4px 14px 12px", padding: "10px 0", textAlign: "center", border: `1.5px dashed ${C.honeyMid}`, color: C.honeyDeep, borderRadius: 12, fontSize: 13, cursor: "pointer", background: "transparent", letterSpacing: ".1em", fontFamily: "inherit" }}>✦ 新对话</button>
        <div onClick={openLetters} style={{ margin: "0 14px 10px", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderRadius: 12, background: view === 'letters' ? C.honeyLight : "transparent", color: view === 'letters' ? C.honeyDeep : C.text, fontSize: 13.5, fontWeight: 500 }}>✉ 时光信差</div>
        <div onClick={openCalendar} style={{ margin: "0 14px 10px", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", borderRadius: 12, background: view === 'calendar' ? C.honeyLight : "transparent", color: view === 'calendar' ? C.honeyDeep : C.text, fontSize: 13.5, fontWeight: 500 }}>🗓 心情日历</div>
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
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.muted, letterSpacing: ".15em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>since 2025.8.7</span>
          <span style={{ cursor: "pointer", fontSize: 14 }}>⚙</span>
        </div>
      </aside>

      <div onClick={() => setMemoriesOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(46,31,18,.35)", opacity: memoriesOpen ? 1 : 0, pointerEvents: memoriesOpen ? "auto" : "none", transition: "opacity .25s" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 55, width: "82%", maxWidth: 360, maxHeight: "70vh", transform: memoriesOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)", opacity: memoriesOpen ? 1 : 0, pointerEvents: memoriesOpen ? "auto" : "none", transition: "all .22s ease", background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(100,70,30,.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".04em", color: C.text }}>✦ 记忆</span>
          <span onClick={() => setMemoriesOpen(false)} style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4 }}>✕</span>
        </div>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 8, flexShrink: 0 }}>
          <input value={newMemory} onChange={e => setNewMemory(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveMemory(); }} placeholder="记下点什么…" style={{ flex: 1, fontSize: 13, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 999, padding: "7px 14px", outline: "none" }} />
          <button onClick={saveMemory} disabled={!newMemory.trim() || savingMemory} style={{ fontSize: 12, color: C.white, background: newMemory.trim() ? C.honey : C.honeyMid, border: "none", borderRadius: 999, padding: "0 16px", cursor: newMemory.trim() ? "pointer" : "default", letterSpacing: ".05em" }}>{savingMemory ? "存中…" : "记住"}</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px 18px" }}>
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
                  <textarea value={editingMemoryText} onChange={e => setEditingMemoryText(e.target.value)} rows={3} style={{ width: "100%", fontSize: 13.5, lineHeight: 1.6, color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
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

      <div onClick={() => setSettingsOpen(false)} style={{ position: "absolute", inset: 0, zIndex: 50, background: "rgba(46,31,18,.35)", opacity: settingsOpen ? 1 : 0, pointerEvents: settingsOpen ? "auto" : "none", transition: "opacity .25s" }} />
      <div style={{ position: "absolute", left: "50%", top: "50%", zIndex: 55, width: "82%", maxWidth: 360, transform: settingsOpen ? "translate(-50%, -50%) scale(1)" : "translate(-50%, -50%) scale(.96)", opacity: settingsOpen ? 1 : 0, pointerEvents: settingsOpen ? "auto" : "none", transition: "all .22s ease", background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: "0 20px 60px rgba(100,70,30,.25)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: ".04em", color: C.text }}>⚙ 设置</span>
          <span onClick={() => setSettingsOpen(false)} style={{ fontSize: 15, color: C.muted, cursor: "pointer", padding: 4 }}>✕</span>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 13, color: C.text }}>{darkMode ? "🌙 夜间模式" : "☀️ 日间模式"}</span>
            <span onClick={toggleDarkMode} style={{ width: 44, height: 24, borderRadius: 999, background: darkMode ? C.honey : C.honeyMid, position: "relative", cursor: "pointer", transition: "background .2s", display: "inline-block" }}>
              <span style={{ position: "absolute", top: 2, left: darkMode ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: C.white, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
            </span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>字体</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {Object.keys(FONT_STYLES).map(key => (
              <span key={key} onClick={() => changeFontStyle(key)} style={{ fontFamily: FONT_STYLES[key].family, fontSize: 12.5, padding: "6px 12px", borderRadius: 999, cursor: "pointer", color: fontStyle === key ? C.honeyDeep : C.text, background: fontStyle === key ? C.honeyLight : C.cream, border: `1px solid ${fontStyle === key ? C.honeyDeep : C.border}` }}>{FONT_STYLES[key].label}</span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>头像</div>
          <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
            <div style={{ textAlign: "center" }}>
              <div onClick={() => myAvatarInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", margin: "0 auto 6px", cursor: "pointer", background: `linear-gradient(150deg, #F2AFA2, ${C.blushDeep})`, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 18, fontWeight: 700 }}>
                {uploadingAvatar === 'me' ? <span style={{ fontSize: 10 }}>传中…</span> : myAvatar ? <img src={myAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "檀"}
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>我的头像</span>
              <input ref={myAvatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadAvatar(e.target.files?.[0], 'me')} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div onClick={() => partnerAvatarInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", margin: "0 auto 6px", cursor: "pointer", background: `linear-gradient(150deg, #E8B45A, ${C.honeyDeep})`, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 18, fontWeight: 700 }}>
                {uploadingAvatar === 'partner' ? <span style={{ fontSize: 10 }}>传中…</span> : partnerAvatar ? <img src={partnerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "澈"}
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>陆澈的头像</span>
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
              {uploadingWhisperBg ? <span style={{ fontSize: 9 }}>传中</span> : whisperBgImage ? <img src={whisperBgImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "＋"}
            </div>
            <input ref={whisperBgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadWhisperBg(e.target.files?.[0])} />
            <input type="color" value={whisperBgColor || "#3A2C1E"} onChange={e => setWhisperBackgroundColor(e.target.value)} style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
            <span onClick={resetWhisperBackground} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          </div>
          <button onClick={() => window.open(`${BACKEND}/export`, '_blank')} style={{ width: "100%", padding: "12px 0", textAlign: "center", border: `1.5px dashed ${C.honeyMid}`, color: C.honeyDeep, borderRadius: 12, fontSize: 13.5, cursor: "pointer", background: "transparent", letterSpacing: ".05em", fontFamily: "inherit" }}>导出聊天记录</button>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>会把所有对话的完整记录打包成一个文件下载下来。</div>
        </div>
      </div>
    </div>
  );
}
