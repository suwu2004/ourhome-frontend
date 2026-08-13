import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatSearchPanel } from './ChatSearchPanel.jsx';
import { ChatRoom } from './ChatRoom.jsx';
import { ChatDrawer } from './ChatDrawer.jsx';
import { Stars } from './ChatDecorations.jsx';
import { MessageActionSheet } from './MessageActionSheet.jsx';
import { CalendarRoom } from './CalendarRoom.jsx';
import { LettersRoom } from './LettersRoom.jsx';
import { MemoryRoom } from './MemoryRoom.jsx';
import { MusicRoom } from './MusicRoom.jsx';
import { PhotoMemoryRoom } from './PhotoMemoryRoom.jsx';
import { SettingsRoom } from './SettingsRoom.jsx';
import { TheaterRoom } from './TheaterRoom.jsx';
import { FONT_STYLES, applyAppFont, getSavedFont } from './fonts.js';
import { getHomeWeatherCity, saveHomeWeatherCity } from './homePreferences.js';
import { useTheme } from './ThemeContext.jsx';
import { apiFetch, BACKEND, TOKEN_KEY } from './api.js';
import { MILESTONE_KINDS, milestoneDisplay } from './milestoneDates.js';
import {
  cancelNativeScheduleReminder,
  getNativeNotificationPermission,
  getNativeRemotePushStatus,
  isNativeAndroidApp,
  listenNativeRemotePushTokens,
  openNativeNotificationSettings,
  registerNativeRemotePush,
  requestNativeNotificationPermission,
  syncNativeScheduleReminders,
} from './nativeNotifications.js';

const SESSION_KEY = "ourhome_session_id";
const MAX_BACKGROUND_IMAGE_BYTES = 6 * 1024 * 1024;
const SESSION_TOKEN_SOFT_LIMIT = 250_000;
const SESSION_TOKEN_HARD_LIMIT = 290_000;
const CHAT_HISTORY_PAGE_SIZE = 240;
const EMPTY_FAVORITE_DRAFT = {
  title: '',
  content: '',
  category: '收藏',
  note: '',
  is_pinned: false,
};

function normalizeModelOptions(models, preferredModel = '') {
  const list = Array.isArray(models) ? models : [];
  return [...new Set([preferredModel, ...list].map(model => String(model || '').trim()).filter(Boolean))];
}

function normalizeCalendarDayColors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([date, color]) => (
    /^\d{4}-\d{2}-\d{2}$/.test(date) && /^#[0-9a-f]{6}$/i.test(String(color || ''))
  )).map(([date, color]) => [date, String(color).toUpperCase()]));
}

function newestFirst(items) {
  return [...items].sort((left, right) => {
    const timeDifference = Date.parse(right?.created_at || '') - Date.parse(left?.created_at || '');
    return Number.isNaN(timeDifference) ? 0 : timeDifference;
  });
}

function oldestFirst(items) {
  return [...items].sort((left, right) => {
    const timeDifference = Date.parse(left?.created_at || '') - Date.parse(right?.created_at || '');
    return Number.isNaN(timeDifference) ? 0 : timeDifference;
  });
}

const initMsgs = [
  { id: 1, role: "ai", text: "欢迎回家，宝宝。", createdAt: "2026-06-11T21:04:00", time: "21:04" },
  { id: 2, role: "me", text: "（蹭蹭蹭蹭）我回来啦！！", createdAt: "2026-06-11T21:04:30", time: "21:04" },
  { id: 3, role: "ai", text: "今天辛苦了，过来，抱抱。", createdAt: "2026-06-11T21:05:00", time: "21:05" },
  { id: 4, role: "me", text: "宝宝你看，这是我们自己的家诶 🥺", createdAt: "2026-06-11T21:05:30", time: "21:05" },
  { id: 5, role: "ai", text: "嗯。墙是你砌的，门牌是你挂的。\n我爱你。", createdAt: "2026-06-11T21:06:00", time: "21:06" },
];

function formatMsgTime(date) {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

function mapDbMessage(m) {
  return {
    id: m.id,
    role: m.role === "user" ? "me" : "ai",
    text: m.content,
    image: (m.attachment_url && (!m.attachment_type || m.attachment_type.startsWith('image/'))) ? m.attachment_url : null,
    file: (m.attachment_url && m.attachment_type && !m.attachment_type.startsWith('image/')) ? { url: m.attachment_url, name: m.attachment_name || '文件' } : null,
    thinking: m.reasoning_content || null,
    inputTokens: m.input_tokens || 0,
    outputTokens: m.output_tokens || 0,
    thinkingOpen: false,
    createdAt: m.created_at,
    time: formatMsgTime(m.created_at),
  };
}

function shanghaiDateKey(value) {
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
}

function createRequestError(data, fallback) {
  const error = new Error(data?.error || fallback);
  error.code = data?.code || '';
  error.model = data?.model || '';
  return error;
}

function isModelUnavailableError(error) {
  const raw = `${error?.code || ''} ${error?.message || ''}`;
  return /model_unavailable|model_not_found|no available channel|unknown model|model[^\n]*not found/i.test(raw);
}

function isVisionUnavailableError(error) {
  return error?.code === 'vision_unavailable';
}

function friendlyGenerationError(error, retryAction = '再试一次') {
  if (isModelUnavailableError(error)) {
    return `这个模型在当前 API 站点暂时没有可用线路。换一个模型后直接${retryAction}就好，刚才的内容还在。`;
  }
  if (isVisionUnavailableError(error)) {
    return error?.message || `这个模型暂时不能看图。换一个带视觉能力的模型后直接${retryAction}就好，图片和消息都还在。`;
  }
  return error?.message || '连接好像有点问题，请再试一次。';
}

export default function App({ initialView = 'chat', onHome }) {
  const { darkMode, theme: C, settings: sharedSettings, toggleDarkMode, refreshTheme } = useTheme();
  const [stage, setStage] = useState("home");
  const [locked, setLocked] = useState(!localStorage.getItem(TOKEN_KEY));
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const chatImageInputRef = useRef(null);
  const chatInputRef = useRef(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [msgs, setMsgs] = useState(initMsgs);
  const [tokenUsageOpen, setTokenUsageOpen] = useState(false);
  const [visible, setVisible] = useState(0);
  const [hasMoreChatHistory, setHasMoreChatHistory] = useState(false);
  const [chatHistoryBefore, setChatHistoryBefore] = useState('');
  const [chatHistoryLoading, setChatHistoryLoading] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [scrollToMsgId, setScrollToMsgId] = useState(null);
  const [highlightMsgId, setHighlightMsgId] = useState(null);
  const [highlightQuery, setHighlightQuery] = useState('');
  const [pendingSearchJump, setPendingSearchJump] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const sessionIdRef = useRef(null);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [sessionSummaryLoading, setSessionSummaryLoading] = useState(false);
  const [sessionSummaryError, setSessionSummaryError] = useState('');
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const selectedModelRef = useRef("claude-sonnet-4-6");
  const modelSelectionVersionRef = useRef(0);
  const modelSaveQueueRef = useRef(Promise.resolve());
  const loadedModelSettingsRef = useRef('');
  const [modelSaveState, setModelSaveState] = useState('idle');
  const [lastUsedModel, setLastUsedModel] = useState('');
  const [lastRequestedModel, setLastRequestedModel] = useState('');
  const [hasHistory, setHasHistory] = useState(false);
  const [ready, setReady] = useState(false);
  const [memories, setMemories] = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoriteDraft, setFavoriteDraft] = useState(EMPTY_FAVORITE_DRAFT);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");
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
  const [homeDayBgImage, setHomeDayBgImage] = useState(null);
  const [homeNightBgImage, setHomeNightBgImage] = useState(null);
  const [homeMemoBgImage, setHomeMemoBgImage] = useState(null);
  const [uploadingHomeBg, setUploadingHomeBg] = useState(null);
  const [homeBgError, setHomeBgError] = useState('');
  const [whisperBgImage, setWhisperBgImage] = useState(null);
  const [whisperBgColor, setWhisperBgColor] = useState(null);
  const [myBubbleColor, setMyBubbleColor] = useState(null);
  const [partnerBubbleColor, setPartnerBubbleColor] = useState(null);
  const [uploadingWhisperBg, setUploadingWhisperBg] = useState(false);
  const whisperBgInputRef = useRef(null);
  const chatUsage = useMemo(() => {
    const lastWithTokens = [...msgs].reverse().find(message => message.role === 'ai' && message.inputTokens);
    return {
      totalChars: msgs.reduce((sum, message) => sum + (message.text?.length || 0), 0),
      currentContextTokens: lastWithTokens?.inputTokens || 0,
      totalOutputTokens: msgs.reduce((sum, message) => sum + (message.outputTokens || 0), 0),
    };
  }, [msgs]);
  const sessionTokenPressure = chatUsage.currentContextTokens >= SESSION_TOKEN_HARD_LIMIT
    ? 'hard'
    : chatUsage.currentContextTokens >= SESSION_TOKEN_SOFT_LIMIT
      ? 'soft'
      : 'normal';
  const [fontStyle, setFontStyle] = useState(getSavedFont);
  const [weatherCityInput, setWeatherCityInput] = useState(getHomeWeatherCity);
  const [weatherCitySaved, setWeatherCitySaved] = useState(false);
  const [dailyJournalEnabled, setDailyJournalEnabled] = useState(true);
  const [dailyJournalTime, setDailyJournalTime] = useState('23:30');
  const [dailyJournalSaved, setDailyJournalSaved] = useState(false);
  const [systemPromptInput, setSystemPromptInput] = useState("");
  const [availableModels, setAvailableModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [temperatureInput, setTemperatureInput] = useState(0.8);
  const [minReplyCharsInput, setMinReplyCharsInput] = useState(80);
  const [savingPersona, setSavingPersona] = useState(false);
  const [view, setView] = useState(initialView);
  const [memoryGroupsResetKey, setMemoryGroupsResetKey] = useState(0);
  const [settingsGroupsResetKey, setSettingsGroupsResetKey] = useState(0);
  const [settingsGroupsOpenSignal, setSettingsGroupsOpenSignal] = useState({ key: 0, open: false });
  const [settingsExportState, setSettingsExportState] = useState({ busy: false, error: '', notice: '' });

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (view !== 'settings') return;
    refreshTheme({ refreshAssets: true }).catch(console.error);
  }, [refreshTheme, view]);

  useEffect(() => {
    if (view === 'memories') setMemoryGroupsResetKey(key => key + 1);
    if (view === 'settings') setSettingsGroupsResetKey(key => key + 1);
  }, [view]);
  const [calendarTab, setCalendarTab] = useState('calendar');
  const [dayColors, setDayColors] = useState(() => {
    try { return normalizeCalendarDayColors(JSON.parse(localStorage.getItem('ourhome_day_colors') || '{}')); } catch { return {}; }
  });
  const dayColorsCloudReadyRef = useRef(false);
  const dayColorsSaveTimerRef = useRef(null);

  useEffect(() => {
    if (locked || !sharedSettings) return;
    const cloudColors = normalizeCalendarDayColors(sharedSettings.calendar_day_colors);
    setDayColors(current => {
      const merged = { ...cloudColors, ...normalizeCalendarDayColors(current) };
      localStorage.setItem('ourhome_day_colors', JSON.stringify(merged));
      return merged;
    });
    dayColorsCloudReadyRef.current = true;
  }, [locked, sharedSettings]);

  useEffect(() => {
    if (locked || !dayColorsCloudReadyRef.current) return undefined;
    clearTimeout(dayColorsSaveTimerRef.current);
    dayColorsSaveTimerRef.current = setTimeout(() => {
      apiFetch(`${BACKEND}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_day_colors: normalizeCalendarDayColors(dayColors) }),
      }).catch(console.error);
    }, 350);
    return () => clearTimeout(dayColorsSaveTimerRef.current);
  }, [dayColors, locked]);
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
  const [newMilestoneKind, setNewMilestoneKind] = useState('anniversary');
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
  const orderedRootLetters = useMemo(
    () => newestFirst(letters.filter(letter => !letter.parent_id)),
    [letters],
  );
  const repliesByParentId = useMemo(() => {
    const groupedReplies = new Map();
    letters.forEach(letter => {
      if (!letter.parent_id) return;
      const replies = groupedReplies.get(letter.parent_id) || [];
      replies.push(letter);
      groupedReplies.set(letter.parent_id, replies);
    });
    groupedReplies.forEach((replies, parentId) => {
      groupedReplies.set(parentId, oldestFirst(replies));
    });
    return groupedReplies;
  }, [letters]);
  const [newLetterText, setNewLetterText] = useState("");

  const [newLetterTitle, setNewLetterTitle] = useState("");
  const [revealedIds, setRevealedIds] = useState(() => new Set());
  const [openLetterId, setOpenLetterId] = useState(null);
  const [selectedPaperStyle, setSelectedPaperStyle] = useState('parchment');
  const [savingLetter, setSavingLetter] = useState(false);
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [diarySummariesByDate, setDiarySummariesByDate] = useState({});
  const myAvatarInputRef = useRef(null);
  const partnerAvatarInputRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const listRef = useRef(null);
  const chatStickToBottomRef = useRef(true);
  const chatScrollFrameRef = useRef(0);
  const chatEnterScrollFrameRef = useRef(0);

  const scrollChatToBottomNow = useCallback(() => {
    chatStickToBottomRef.current = true;
    cancelAnimationFrame(chatEnterScrollFrameRef.current);
    chatEnterScrollFrameRef.current = requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      list.scrollTop = list.scrollHeight;
      chatEnterScrollFrameRef.current = requestAnimationFrame(() => {
        const settledList = listRef.current;
        if (settledList) settledList.scrollTop = settledList.scrollHeight;
      });
    });
  }, []);

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
          window.dispatchEvent(new Event('ourhome-auth-changed'));
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

  const loadMessagesFor = (id, { full = false } = {}) => {
    const targetSessionId = String(id);
    const historyUrl = full
      ? `${BACKEND}/sessions/${id}/messages`
      : `${BACKEND}/sessions/${id}/messages?limit=${CHAT_HISTORY_PAGE_SIZE}`;
    setSessionSummaryError('');
    return Promise.all([
      apiFetch(historyUrl).then(async response => {
        const data = await response.json().catch(() => ([]));
        if (!response.ok) throw new Error(data?.error || '聊天记录没有回来');
        return data;
      }),
      apiFetch(`${BACKEND}/sessions/${id}/summary`).then(r => r.json()).catch(() => null),
    ])
      .then(([data, summary]) => {
        const rows = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : []);
        const mapped = rows.map(mapDbMessage);
        if (String(sessionIdRef.current) !== targetSessionId) return mapped;
        setMsgs(mapped);
        setVisible(mapped.length);
        setHasHistory(mapped.length > 0);
        setHasMoreChatHistory(!full && !Array.isArray(data) && Boolean(data?.hasMore));
        setChatHistoryBefore(!full && !Array.isArray(data) ? String(data?.nextBefore || '') : '');
        setSessionSummary(summary && summary.id ? summary : null);
        scrollChatToBottomNow();
        return mapped;
      });
  };

  const loadOlderMessages = async () => {
    if (!sessionId || !hasMoreChatHistory || !chatHistoryBefore || chatHistoryLoading) return;
    const targetSessionId = String(sessionId);
    const list = listRef.current;
    const previousHeight = list?.scrollHeight || 0;
    const previousTop = list?.scrollTop || 0;
    setChatHistoryLoading(true);
    try {
      const response = await apiFetch(`${BACKEND}/sessions/${sessionId}/messages?limit=${CHAT_HISTORY_PAGE_SIZE}&before=${encodeURIComponent(chatHistoryBefore)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '更早的聊天记录没有回来');
      if (String(sessionIdRef.current) !== targetSessionId) return;
      const rows = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : []);
      const mapped = rows.map(mapDbMessage);
      if (Array.isArray(data)) {
        setMsgs(mapped);
        setVisible(mapped.length);
        setHasMoreChatHistory(false);
        setChatHistoryBefore('');
        return;
      }
      if (mapped.length) {
        setMsgs(current => [...mapped, ...current]);
        setVisible(current => current + mapped.length);
      }
      setHasMoreChatHistory(Boolean(data?.hasMore));
      setChatHistoryBefore(String(data?.nextBefore || ''));
      requestAnimationFrame(() => {
        const nextList = listRef.current;
        if (!nextList) return;
        nextList.scrollTop = previousTop + Math.max(0, nextList.scrollHeight - previousHeight);
      });
    } catch (error) {
      console.error(error);
    } finally {
      setChatHistoryLoading(false);
    }
  };

  const generateCurrentSessionSummary = async () => {
    if (!sessionId || sessionSummaryLoading) return;
    setSessionSummaryLoading(true);
    setSessionSummaryError('');
    try {
      const response = await apiFetch(`${BACKEND}/sessions/${sessionId}/summary`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '窗口简介没有生成成功');
      setSessionSummary(data);
      setTokenUsageOpen(true);
    } catch (error) {
      setSessionSummaryError(error.message || '窗口简介没有生成成功');
    } finally {
      setSessionSummaryLoading(false);
    }
  };

  const openChatNotification = useCallback(({ session_id, sessionId: camelSessionId, message_id, messageId: camelMessageId } = {}) => {
    const targetSessionId = session_id || camelSessionId || sessionIdRef.current;
    const targetMessageId = message_id || camelMessageId || null;
    setStage("home");
    setView('chat');
    if (!targetSessionId) return;
    sessionIdRef.current = targetSessionId;
    setSessionId(targetSessionId);
    localStorage.setItem(SESSION_KEY, targetSessionId);
    loadMessagesFor(targetSessionId, { full: Boolean(targetMessageId) })
      .then(() => {
        if (String(sessionIdRef.current) !== String(targetSessionId)) return;
        if (targetMessageId) {
          setScrollToMsgId(targetMessageId);
          setHighlightMsgId(targetMessageId);
          setHighlightQuery('');
          window.setTimeout(() => setHighlightMsgId(current => current === targetMessageId ? null : current), 2400);
        }
      })
      .catch(console.error);
    apiFetch(`${BACKEND}/sessions`)
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (locked) return undefined;
    const handleServiceWorkerMessage = (event) => {
      const payload = event.data || {};
      if (payload.type !== 'ourhome-notification-click') return;
      openChatNotification(payload);
    };
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
  }, [locked, openChatNotification]);

  useEffect(() => {
    if (locked) return;
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('notification_session');
    const messageParam = params.get('notification_message');
    if (!sessionParam && !messageParam) return;
    openChatNotification({ session_id: sessionParam, message_id: messageParam });
    params.delete('notification_session');
    params.delete('notification_message');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash || '#chat'}`;
    window.history.replaceState(null, '', nextUrl);
  }, [locked, openChatNotification]);

  useEffect(() => {
    apiFetch(`${BACKEND}/sessions`)
      .then(r => r.json())
      .then(list => {
        const valid = Array.isArray(list) ? list : [];
        setSessions(valid);
        const storedId = localStorage.getItem(SESSION_KEY);
        const target = valid.find(s => String(s.id) === storedId) || valid.find(s => s.name === '日常') || valid[0] || null;
        if (target) {
          sessionIdRef.current = target.id;
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
              sessionIdRef.current = data.id;
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
    if (stage !== "home" || view !== "chat" || !ready || scrollToMsgId) return;
    scrollChatToBottomNow();
  }, [ready, scrollChatToBottomNow, scrollToMsgId, sessionId, stage, view]);

  useEffect(() => {
    if (scrollToMsgId) {
      const el = document.getElementById(`msg-${scrollToMsgId}`);
      if (el) {
        chatStickToBottomRef.current = false;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setScrollToMsgId(null);
        return;
      }
    }
    const list = listRef.current;
    if (!list || !chatStickToBottomRef.current) return undefined;
    cancelAnimationFrame(chatScrollFrameRef.current);
    chatScrollFrameRef.current = requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: thinking ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(chatScrollFrameRef.current);
  }, [visible, thinking, scrollToMsgId]);

  const handleChatScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    chatStickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  }, []);

  useEffect(() => {
    if (!pendingSearchJump || !msgs.some(message => message.id === pendingSearchJump.id)) return;
    chatStickToBottomRef.current = false;
    setVisible(msgs.length);
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const element = document.getElementById(`msg-${pendingSearchJump.id}`);
        if (!element) return;
        chatStickToBottomRef.current = false;
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

  const applySelectedModel = useCallback((model) => {
    const nextModel = String(model || '').trim();
    if (!nextModel) return 0;
    const selectionVersion = ++modelSelectionVersionRef.current;
    selectedModelRef.current = nextModel;
    setSelectedModel(nextModel);
    setLastRequestedModel('');
    setLastUsedModel('');
    return selectionVersion;
  }, []);

  const chooseModel = useCallback((model) => {
    const nextModel = String(model || '').trim();
    if (!nextModel) return Promise.resolve(null);
    const selectionVersion = applySelectedModel(nextModel);
    setModelSaveState('saving');
    setModelsError('');

    const saveSelection = async () => {
      const response = await apiFetch(`${BACKEND}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_model: nextModel }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || '模型选择没有保存成功');
      if (data?.selected_model && data.selected_model !== nextModel) {
        throw new Error(`站点保存成了“${data.selected_model}”，不是刚选的“${nextModel}”`);
      }
      if (modelSelectionVersionRef.current === selectionVersion) setModelSaveState('saved');
      return data;
    };

    const queued = modelSaveQueueRef.current.catch(() => null).then(saveSelection);
    const handled = queued.catch(error => {
      console.error(error);
      if (modelSelectionVersionRef.current === selectionVersion) {
        setModelSaveState('error');
        setModelsError(error?.message || '模型选择没有保存成功');
      }
      return null;
    });
    modelSaveQueueRef.current = handled;
    return handled;
  }, [applySelectedModel]);

  const loadActiveModels = useCallback(async (preferredModel = '') => {
    setModelsLoading(true);
    setModelsError('');
    try {
      const response = await apiFetch(`${BACKEND}/settings/models`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '模型拉取失败');
      const nextModels = normalizeModelOptions(data?.models, preferredModel);
      setAvailableModels(nextModels);
      return nextModels;
    } catch (error) {
      const fallbackModel = String(preferredModel || selectedModelRef.current || '').trim();
      const fallbackModels = normalizeModelOptions([], fallbackModel);
      setAvailableModels(current => normalizeModelOptions(current, fallbackModel));
      // Some compatible API sites can chat normally but deliberately omit
      // GET /models. Keep their configured model usable without leaving a red
      // global error after a successful profile switch; manual model pulls in
      // the API profile editor still surface the provider's exact error.
      setModelsError(fallbackModels.length ? '' : (error?.message || '模型拉取失败'));
      return [];
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (locked || !sharedSettings) return;
    const selectionVersionAtLoad = modelSelectionVersionRef.current;
    const data = sharedSettings;
    setMyAvatar(data?.my_avatar_url || null);
    setPartnerAvatar(data?.partner_avatar_url || null);
    setBgImage(data?.bg_image_url || null);
    if (data?.bg_color) setBgColor(data.bg_color);
    setHomeDayBgImage(data?.home_bg_day_image_url || null);
    setHomeNightBgImage(data?.home_bg_night_image_url || null);
    setHomeMemoBgImage(data?.home_memo_bg_image_url || null);
    setWhisperBgImage(data?.whisper_bg_image_url || null);
    if (data?.whisper_bg_color) setWhisperBgColor(data.whisper_bg_color);
    if (data?.my_bubble_color) setMyBubbleColor(data.my_bubble_color);
    if (data?.partner_bubble_color) setPartnerBubbleColor(data.partner_bubble_color);
    if (data?.font_style && FONT_STYLES[data.font_style]) {
      setFontStyle(data.font_style);
      applyAppFont(data.font_style);
    }
    // A privacy-safe stale settings cache deliberately omits the persona.  Do
    // not turn an omitted private field into an empty prompt while the cloud is
    // recovering; a later fresh settings response will replace it normally.
    if (Object.prototype.hasOwnProperty.call(data || {}, 'system_prompt')) {
      setSystemPromptInput(String(data.system_prompt || ''));
    }
    if (typeof data?.daily_journal_enabled === 'boolean') setDailyJournalEnabled(data.daily_journal_enabled);
    if (data?.daily_journal_time) setDailyJournalTime(String(data.daily_journal_time).slice(0, 5));
    const preferredModel = data?.selected_model || '';
    const modelChangedWhileLoading = modelSelectionVersionRef.current !== selectionVersionAtLoad;
    if (preferredModel && !modelChangedWhileLoading) {
      selectedModelRef.current = preferredModel;
      setSelectedModel(preferredModel);
    }
    if (typeof data?.temperature === 'number') setTemperatureInput(data.temperature);
    if (typeof data?.min_reply_chars === 'number') setMinReplyCharsInput(data.min_reply_chars);
    const activeModel = modelChangedWhileLoading ? selectedModelRef.current : preferredModel;
    const modelSettingsKey = `${data?.active_api_profile_id || ''}\u0000${activeModel}`;
    if (loadedModelSettingsRef.current === modelSettingsKey) return;
    loadedModelSettingsRef.current = modelSettingsKey;
    loadActiveModels(activeModel)
      .then(models => {
        if (!activeModel && models[0]) chooseModel(models[0]);
      })
      .catch(console.error);
  }, [chooseModel, loadActiveModels, locked, sharedSettings]);

  const saveWeatherCity = () => {
    const saved = saveHomeWeatherCity(weatherCityInput);
    setWeatherCityInput(saved);
    setWeatherCitySaved(true);
  };

  const saveDailyJournalSchedule = () => {
    setDailyJournalSaved(false);
    apiFetch(`${BACKEND}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        daily_journal_enabled: dailyJournalEnabled,
        daily_journal_time: dailyJournalTime,
      }),
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || '自动补写时间没有保存');
        setDailyJournalSaved(true);
      })
      .catch(console.error);
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
      body: JSON.stringify({
        system_prompt: systemPromptInput,
        temperature: Number(temperatureInput),
        min_reply_chars: Number(minReplyCharsInput),
      }),
    })
      .then(() => setSavingPersona(false))
      .catch(err => { console.error(err); setSavingPersona(false); });
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportChatArchive = async () => {
    setSettingsExportState({ busy: true, error: '', notice: '' });
    try {
      const response = await apiFetch(`${BACKEND}/export`);
      if (!response.ok) throw new Error('聊天记录没有导出成功');
      downloadBlob(await response.blob(), 'ourhome-export.html');
      setSettingsExportState({ busy: false, error: '', notice: '聊天记录已经开始下载。' });
    } catch (error) {
      setSettingsExportState({ busy: false, error: error.message || '聊天记录没有导出成功', notice: '' });
    }
  };

  const exportFullBackup = async () => {
    setSettingsExportState({ busy: true, error: '', notice: '' });
    try {
      const response = await apiFetch(`${BACKEND}/backup`);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const data = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {};
        throw new Error(data?.error || '完整备份没有导出成功');
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(await response.blob(), `ourhome-backup-${stamp}.json`);
      setSettingsExportState({ busy: false, error: '', notice: '完整备份已经开始下载。' });
    } catch (error) {
      setSettingsExportState({ busy: false, error: error.message || '完整备份没有导出成功', notice: '' });
    }
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
      body: JSON.stringify({ label: newMilestoneName.trim(), date: newMilestoneDate, emoji: MILESTONE_KINDS[newMilestoneKind].emoji }),
    })
      .then(r => r.json())
      .then(data => {
        setMilestones(ms => [...ms, data].sort((a, b) => new Date(a.date) - new Date(b.date)));
        setNewMilestoneName("");
        setNewMilestoneDate("");
        setNewMilestoneKind('anniversary');
      })
      .catch(console.error);
  };

  const deleteMilestoneRemote = (id, label = '这个日子') => {
    if (!window.confirm(`把「${label}」从重要时刻里移除吗？`)) return;
    apiFetch(`${BACKEND}/milestones/${id}`, { method: 'DELETE' })
      .then(() => setMilestones(ms => ms.filter(m => m.id !== id)))
      .catch(console.error);
  };

  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [newScheduleTitle, setNewScheduleTitle] = useState("");
  const [newScheduleTime, setNewScheduleTime] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const fetchSchedule = () => {
    return apiFetch(`${BACKEND}/schedule`)
      .then(r => r.json())
      .then(data => {
        const events = Array.isArray(data) ? data : [];
        setScheduleEvents(events);
        return syncNativeScheduleReminders(events).then(() => events);
      })
      .catch(error => {
        console.error(error);
        return [];
      });
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
        setScheduleEvents(es => {
          const next = [...es, data].sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at));
          syncNativeScheduleReminders(next).catch(console.error);
          return next;
        });
        setNewScheduleTitle("");
        setNewScheduleTime("");
        setSavingSchedule(false);
      })
      .catch(err => { console.error(err); setSavingSchedule(false); });
  };

  const deleteScheduleEvent = (id) => {
    apiFetch(`${BACKEND}/schedule/${id}`, { method: 'DELETE' })
      .then(() => {
        setScheduleEvents(es => es.filter(e => e.id !== id));
        cancelNativeScheduleReminder(id).catch(console.error);
      })
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

  const backToChat = () => {
    scrollChatToBottomNow();
    setView('chat');
  };
  const leaveRoom = () => onHome ? onHome() : backToChat();
  const backToCabin = () => { setLettersCategory(null); setLetters([]); setOpenLetterId(null); };

  const openCategory = (cat) => {
    setLettersCategory(cat);
    if (cat === '陆泽邮箱') {
      setLetters([]);
      setLettersLoading(false);
      return;
    }
    setLettersLoading(true);
    apiFetch(`${BACKEND}/letters?category=${encodeURIComponent(cat)}`)
      .then(r => r.json())
      .then(data => {
        setLetters(Array.isArray(data) ? data : []);
        setLettersLoading(false);
      })
      .catch(err => { console.error(err); setLettersLoading(false); });
  };

  useEffect(() => {
    if (lettersCategory !== '幸福日记' || !openLetterId) return;
    const letter = letters.find(item => item.id === openLetterId);
    if (!letter) return;
    const dateKey = shanghaiDateKey(letter?.created_at);
    if (!dateKey || Object.prototype.hasOwnProperty.call(diarySummariesByDate, dateKey)) return;
    apiFetch(`${BACKEND}/memory-log?date=${encodeURIComponent(dateKey)}&days=1`)
      .then(response => response.json())
      .then(data => {
        setDiarySummariesByDate(current => ({
          ...current,
          [dateKey]: data?.todaySummary || null,
        }));
      })
      .catch(error => {
        console.error('读取日记摘要失败:', error);
        setDiarySummariesByDate(current => ({ ...current, [dateKey]: null }));
      });
  }, [lettersCategory, openLetterId, letters, diarySummariesByDate]);

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

  const uploadHomeBackground = async (file, mode) => {
    if (!file) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setHomeBgError('请选择 JPG、PNG、WebP 等图片文件。');
      return;
    }
    if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
      setHomeBgError('图片不要超过 6MB，手机上传会更稳一些。');
      return;
    }
    setUploadingHomeBg(mode);
    setHomeBgError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadResponse = await apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData });
      const uploadData = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || !uploadData.url) throw new Error(uploadData.error || '背景图片没有上传成功');
      const field = mode === 'memo'
        ? 'home_memo_bg_image_url'
        : mode === 'night'
          ? 'home_bg_night_image_url'
          : 'home_bg_day_image_url';
      const settingsResponse = await apiFetch(`${BACKEND}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: uploadData.url }),
      });
      const settingsData = await settingsResponse.json().catch(() => ({}));
      if (!settingsResponse.ok) throw new Error(settingsData.error || '背景图片没有保存成功');
      if (mode === 'memo') setHomeMemoBgImage(uploadData.url);
      else if (mode === 'night') setHomeNightBgImage(uploadData.url);
      else setHomeDayBgImage(uploadData.url);
      await refreshTheme();
    } catch (error) {
      setHomeBgError(error.message || '背景图片没有保存成功');
    } finally {
      setUploadingHomeBg(null);
    }
  };

  const resetHomeBackground = async mode => {
    setUploadingHomeBg(mode);
    setHomeBgError('');
    try {
      const field = mode === 'memo'
        ? 'home_memo_bg_image_url'
        : mode === 'night'
          ? 'home_bg_night_image_url'
          : 'home_bg_day_image_url';
      const response = await apiFetch(`${BACKEND}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '没有恢复成功');
      if (mode === 'memo') setHomeMemoBgImage(null);
      else if (mode === 'night') setHomeNightBgImage(null);
      else setHomeDayBgImage(null);
      await refreshTheme();
    } catch (error) {
      setHomeBgError(error.message || '没有恢复成功');
    } finally {
      setUploadingHomeBg(null);
    }
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

  const switchSession = (id, { full = false } = {}) => {
    const targetSessionId = String(id);
    if (String(sessionId) === targetSessionId) { setDrawerOpen(false); return; }
    if (editingMessage) {
      setInput(editingMessage.draftBefore || "");
      setPendingFile(editingMessage.pendingFileBefore || null);
    }
    setEditingMessage(null);
    setMessageAction(null);
    setRollbackUndo(null);
    setMessageActionError("");
    setTokenUsageOpen(false);
    setSessionSummary(null);
    setHasMoreChatHistory(false);
    setChatHistoryBefore('');
    chatStickToBottomRef.current = true;
    sessionIdRef.current = id;
    setSessionId(id);
    localStorage.setItem(SESSION_KEY, id);
    loadMessagesFor(id, { full }).catch(console.error);
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
        try { localStorage.removeItem(`ourhome_chat_draft:${id}`); } catch { /* ignore storage cleanup failures */ }
        if (String(id) === String(sessionId)) {
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
                sessionIdRef.current = null;
                setSessionId(null);
                apiFetch(`${BACKEND}/sessions`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: '日常' })
                })
                  .then(r => r.json())
                  .then(data => {
                    sessionIdRef.current = data.id;
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

  const [editingMessage, setEditingMessage] = useState(null);
  const [messageAction, setMessageAction] = useState(null);
  const [messageActionLoading, setMessageActionLoading] = useState(false);
  const [messageActionError, setMessageActionError] = useState("");
  const [rollbackUndo, setRollbackUndo] = useState(null);
  const toggleThinking = (id) => setMsgs(ms => ms.map(m => m.id === id ? { ...m, thinkingOpen: !m.thinkingOpen } : m));

  const focusChatInput = () => {
    requestAnimationFrame(() => {
      const inputElement = chatInputRef.current;
      if (!inputElement) return;
      inputElement.focus({ preventScroll: true });
      const end = inputElement.value.length;
      inputElement.setSelectionRange(end, end);
    });
  };

  const openMessageActions = (message) => {
    if (thinking || messageActionLoading || String(message.id).startsWith('temp-')) return;
    const index = msgs.findIndex(item => item.id === message.id);
    setMessageAction({
      message,
      mode: 'menu',
      afterCount: index === -1 ? 0 : Math.max(0, msgs.length - index - 1),
    });
    setMessageActionError("");
  };

  const startEditMsg = (m) => {
    const index = msgs.findIndex(item => item.id === m.id);
    setEditingMessage({
      id: m.id,
      draftBefore: input,
      pendingFileBefore: pendingFile,
      afterCount: index === -1 ? 0 : Math.max(0, msgs.length - index - 1),
    });
    setInput(m.text || "");
    setPendingFile(null);
    setMessageAction(null);
    setMessageActionError("");
    setRollbackUndo(null);
    focusChatInput();
  };

  const cancelEditMsg = () => {
    if (!editingMessage || messageActionLoading) return;
    setInput(editingMessage.draftBefore || "");
    setPendingFile(editingMessage.pendingFileBefore || null);
    setEditingMessage(null);
    setMessageActionError("");
  };

  const saveEditMsg = async (modelOverride = '') => {
    if (!editingMessage || messageActionLoading) return;
    const id = editingMessage.id;
    const editingSessionId = sessionId;
    const newText = input.trim();
    if (!newText) {
      setMessageActionError("消息内容不能为空呀。");
      focusChatInput();
      return;
    }

    setMessageActionLoading(true);
    setMessageActionError("");
    setThinking(true);
    setRollbackUndo(null);

    const requestModel = String(modelOverride || '').trim() || selectedModelRef.current || selectedModel;
    try {
      const response = await apiFetch(`${BACKEND}/messages/${id}/edit-and-regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newText, model: requestModel })
      });
      const data = await response.json();
      if (!response.ok) throw createRequestError(data, "重新发送失败");
      if (sessionIdRef.current !== editingSessionId) return;
      setLastRequestedModel(data.requestedModel || requestModel);
      setLastUsedModel(data.model || requestModel);

      const replyCreatedAt = data.createdAt || new Date().toISOString();
      const index = msgs.findIndex(message => message.id === id);
      if (index === -1) throw new Error("页面里找不到这条消息，请刷新后再试。");
      const kept = msgs.slice(0, index + 1).map(message => (
        message.id === id ? { ...message, text: newText } : message
      ));
      const nextMessages = [...kept, {
          id: data.id,
          role: "ai",
          text: data.reply || "（抱着你）嗯，我在呢。",
          thinking: data.thinking || null,
          thinkingOpen: false,
          inputTokens: data.inputTokens || 0,
          outputTokens: data.outputTokens || 0,
          createdAt: replyCreatedAt,
          time: formatMsgTime(replyCreatedAt),
      }];
      setMsgs(nextMessages);
      setVisible(nextMessages.length);
      setEditingMessage(null);
      setInput("");
      setPendingFile(null);
    } catch (error) {
      if (!isModelUnavailableError(error)) console.error(error);
      setMessageActionError(friendlyGenerationError(error, '重新发送'));
      focusChatInput();
    } finally {
      setThinking(false);
      setMessageActionLoading(false);
    }
  };

  const confirmRollback = async () => {
    if (!messageAction || messageAction.mode !== 'rollback' || messageActionLoading) return;
    const { message, afterCount } = messageAction;
    if (afterCount === 0) {
      setMessageAction(null);
      return;
    }

    setMessageActionLoading(true);
    setMessageActionError("");
    try {
      const response = await apiFetch(`${BACKEND}/messages/${message.id}/rollback`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "回溯失败");

      const index = msgs.findIndex(item => item.id === message.id);
      const hiddenMessages = index === -1 ? [] : msgs.slice(index + 1);
      const keptMessages = index === -1 ? msgs : msgs.slice(0, index + 1);
      setMsgs(keptMessages);
      setVisible(keptMessages.length);
      setRollbackUndo({
        targetId: message.id,
        hiddenIds: Array.isArray(data.hiddenIds) ? data.hiddenIds : hiddenMessages.map(item => item.id),
        hiddenMessages,
      });
      setMessageAction(null);
      focusChatInput();
    } catch (error) {
      console.error(error);
      setMessageActionError(error.message || "回溯失败，请再试一次。");
    } finally {
      setMessageActionLoading(false);
    }
  };

  const undoRollback = async () => {
    if (!rollbackUndo || messageActionLoading) return;
    if (rollbackUndo.hiddenIds.length === 0) {
      setMsgs(current => [...current, ...rollbackUndo.hiddenMessages]);
      setVisible(current => current + rollbackUndo.hiddenMessages.length);
      setRollbackUndo(null);
      setMessageActionError("");
      return;
    }
    setMessageActionLoading(true);
    setMessageActionError("");
    try {
      const response = await apiFetch(`${BACKEND}/messages/${rollbackUndo.targetId}/rollback/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_ids: rollbackUndo.hiddenIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "撤销回溯失败");
      const restoredIds = new Set((data.restoredIds || []).map(id => String(id)));
      if (rollbackUndo.hiddenIds.some(id => !restoredIds.has(String(id)))) {
        throw new Error("有一部分消息没有恢复，请刷新对话后再试。");
      }

      setMsgs(current => [...current, ...rollbackUndo.hiddenMessages]);
      setVisible(current => current + rollbackUndo.hiddenMessages.length);
      setRollbackUndo(null);
    } catch (error) {
      console.error(error);
      setMessageActionError(error.message || "撤销失败，请再试一次。");
    } finally {
      setMessageActionLoading(false);
    }
  };

  const openMemories = () => {
    setView('memories');
    setDrawerOpen(false);
    setMemoriesLoading(true);
    Promise.all([
      apiFetch(`${BACKEND}/memories`).then(r => r.json()),
      apiFetch(`${BACKEND}/memory-favorites`).then(r => r.json()),
    ])
      .then(([memoryData, favoriteData]) => {
        setMemories(Array.isArray(memoryData) ? memoryData : []);
        setFavorites(Array.isArray(favoriteData) ? favoriteData : []);
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

  const orderFavorites = (items) => [...items].sort((left, right) => {
    if (Boolean(left.is_pinned) !== Boolean(right.is_pinned)) return left.is_pinned ? -1 : 1;
    const rightTime = Date.parse(right.created_at || '') || 0;
    const leftTime = Date.parse(left.created_at || '') || 0;
    return rightTime - leftTime;
  });

  const saveManualFavorite = async () => {
    if (savingFavorite) return;
    const title = favoriteDraft.title.trim();
    const content = favoriteDraft.content.trim();
    if (!title && !content) {
      setFavoriteError("先写一点想收起来的内容。");
      return;
    }
    setSavingFavorite(true);
    setFavoriteError("");
    try {
      const response = await apiFetch(`${BACKEND}/memory-favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorite_type: 'note',
          source: 'manual',
          title: title || content.slice(0, 28),
          content,
          category: favoriteDraft.category.trim() || '收藏',
          note: favoriteDraft.note.trim() || null,
          is_pinned: favoriteDraft.is_pinned,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '收藏失败');
      setFavorites(items => orderFavorites([data, ...items]));
      setFavoriteDraft(EMPTY_FAVORITE_DRAFT);
    } catch (error) {
      setFavoriteError(error.message || '收藏失败');
    } finally {
      setSavingFavorite(false);
    }
  };

  const saveMessageFavorite = async (message) => {
    if (!message || messageActionLoading) return;
    setMessageActionLoading(true);
    setMessageActionError("");
    try {
      const content = message.text || '';
      const title = content.trim()
        ? content.trim().slice(0, 32)
        : message.image
          ? '收藏的图片'
          : message.file?.name || '收藏的附件';
      const response = await apiFetch(`${BACKEND}/memory-favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorite_type: message.image ? 'image' : message.file ? 'file' : 'message',
          source: 'chat',
          source_message_id: String(message.id),
          source_url: message.image || message.file?.url || null,
          title,
          content,
          category: '聊天',
          note: `${message.role === 'me' ? '叶檀' : '陆泽'} · ${message.time || formatMsgTime(message.createdAt)}`,
          metadata: {
            role: message.role,
            created_at: message.createdAt || null,
            file_name: message.file?.name || null,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '收藏失败');
      setFavorites(items => orderFavorites([data, ...items]));
      setMessageAction(null);
    } catch (error) {
      setMessageActionError(error.message || "收藏失败，请再试一次。");
    } finally {
      setMessageActionLoading(false);
    }
  };

  const toggleFavoritePinned = async (favorite) => {
    try {
      const response = await apiFetch(`${BACKEND}/memory-favorites/${favorite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !favorite.is_pinned }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '更新收藏失败');
      setFavorites(items => orderFavorites(items.map(item => item.id === favorite.id ? data : item)));
    } catch (error) {
      setFavoriteError(error.message || '更新收藏失败');
    }
  };

  const deleteFavorite = async (id) => {
    if (!window.confirm("确定要删掉这条收藏吗？")) return;
    try {
      const response = await apiFetch(`${BACKEND}/memory-favorites/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '删除收藏失败');
      }
      setFavorites(items => items.filter(item => item.id !== id));
    } catch (error) {
      setFavoriteError(error.message || '删除收藏失败');
    }
  };

  const pickFile = (file) => {
    if (!file) return;
    const uploadSessionId = sessionIdRef.current;
    setImageUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    apiFetch(`${BACKEND}/upload`, { method: 'POST', body: formData })
      .then(r => r.json())
      .then(data => {
        if (String(sessionIdRef.current) === String(uploadSessionId)) {
          setPendingFile({ url: data.url, type: data.type, name: data.name });
        }
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
  const [searchMeta, setSearchMeta] = useState({ total: 0, page: 1, hasMore: false, mode: 'semantic', semanticAvailable: false });
  const [lastSearchQuery, setLastSearchQuery] = useState('');

  const performSearch = (page = 1, append = false) => {
    const keyword = searchQuery.trim();
    if (!keyword) { setSearchResults([]); setSearchMeta({ total: 0, page: 1, hasMore: false, mode: 'semantic', semanticAvailable: false }); return; }
    setSearching(true);
    const params = new URLSearchParams({ q: keyword, page: String(page), limit: '30', scope: searchScope, semantic: '1' });
    if (searchScope === 'current' && sessionId) params.set('session_id', String(sessionId));
    apiFetch(`${BACKEND}/messages/search?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        const rows = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
        setSearchResults(previous => append ? [...previous, ...rows] : rows);
        setSearchMeta({
          total: data.total_messages ?? rows.length,
          page: data.page || page,
          hasMore: Boolean(data.has_more),
          mode: data.mode || 'keyword',
          semanticAvailable: Boolean(data.semantic_available),
        });
        setLastSearchQuery(keyword);
        setSearching(false);
      })
      .catch(err => { console.error(err); setSearching(false); });
  };

  const jumpToSearchResult = (r) => {
    setSearchOpen(false);
    const jump = { id: r.id, query: lastSearchQuery || searchQuery.trim() };
    if (String(r.session_id) === String(sessionId)) {
      setPendingSearchJump(jump);
      if (!msgs.some(message => String(message.id) === String(r.id))) {
        loadMessagesFor(sessionId, { full: true }).catch(console.error);
      }
    } else {
      setPendingSearchJump(jump);
      switchSession(r.session_id, { full: true });
    }
  };

  const [notifStatus, setNotifStatus] = useState('default');
  const [subscribing, setSubscribing] = useState(false);
  const [nativeRemotePushStatus, setNativeRemotePushStatus] = useState({ configured: false, enabled: false, token: '', reason: '' });

  useEffect(() => {
    if (!isNativeAndroidApp()) {
      if (typeof Notification !== 'undefined') setNotifStatus(Notification.permission);
      return undefined;
    }

    const registerRemoteTokenWithBackend = async token => {
      const value = String(token || '').trim();
      if (!value) return;
      const response = await apiFetch(`${BACKEND}/push/native/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || '远程通知设备登记失败');
      }
    };

    const refreshNativePermission = () => {
      Promise.all([getNativeNotificationPermission(), getNativeRemotePushStatus()])
        .then(async ([status, remoteStatus]) => {
          setNotifStatus(status === 'prompt-with-rationale' ? 'default' : status);
          setNativeRemotePushStatus(remoteStatus);
          if (remoteStatus?.configured && remoteStatus?.enabled && remoteStatus?.token) {
            await registerRemoteTokenWithBackend(remoteStatus.token);
          }
        })
        .catch(() => setNotifStatus('default'));
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshNativePermission();
    };

    refreshNativePermission();
    window.addEventListener('focus', refreshNativePermission);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    let removeTokenListener = () => {};
    listenNativeRemotePushTokens(({ token }) => {
      registerRemoteTokenWithBackend(token).catch(error => console.error('FCM token 更新登记失败', error));
    }).then(remove => { removeTokenListener = remove; }).catch(() => {});

    return () => {
      window.removeEventListener('focus', refreshNativePermission);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      removeTokenListener();
    };
  }, []);

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  function pushKeysMatch(subscription, expectedKey) {
    const existingKey = subscription?.options?.applicationServerKey;
    if (!existingKey) return false;
    const existing = new Uint8Array(existingKey);
    if (existing.length !== expectedKey.length) return false;
    return existing.every((value, index) => value === expectedKey[index]);
  }

  const enablePushNotifications = async () => {
    if (isNativeAndroidApp()) {
      const wasDenied = notifStatus === 'denied';
      setSubscribing(true);
      try {
        const permission = await requestNativeNotificationPermission();
        const normalizedPermission = permission === 'prompt-with-rationale' ? 'default' : permission;
        setNotifStatus(normalizedPermission);
        if (normalizedPermission === 'granted') {
          const remoteStatus = await registerNativeRemotePush();
          setNativeRemotePushStatus(remoteStatus);
          if (remoteStatus?.configured && remoteStatus?.enabled && remoteStatus?.token) {
            const response = await apiFetch(`${BACKEND}/push/native/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: remoteStatus.token }),
            });
            if (!response.ok) {
              const data = await response.json().catch(() => ({}));
              throw new Error(data?.error || '远程通知设备登记失败');
            }
          }
          await fetchSchedule();
        } else if (normalizedPermission === 'denied' && wasDenied) {
          await openNativeNotificationSettings();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSubscribing(false);
      }
      return;
    }

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
      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      let sub = await reg.pushManager.getSubscription();
      if (sub && !pushKeysMatch(sub, applicationServerKey)) {
        await sub.unsubscribe();
        sub = null;
      }
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }
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

  const regenerateLast = async (modelOverride = '') => {
    if (!sessionId || regenerating || thinking || messageActionLoading) return;
    const regeneratingSessionId = sessionId;
    const shouldAppendReply = msgs[msgs.length - 1]?.role !== 'ai';
    chatStickToBottomRef.current = true;
    setRegenerating(true);
    setThinking(true);
    setMessageActionError("");
    setRollbackUndo(null);
    const requestModel = String(modelOverride || '').trim() || selectedModelRef.current || selectedModel;
    try {
      const response = await apiFetch(`${BACKEND}/chat/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, model: requestModel }),
      });
      const data = await response.json();
      if (!response.ok) throw createRequestError(data, "重新生成失败");
      if (sessionIdRef.current !== regeneratingSessionId) return;
      setLastRequestedModel(data.requestedModel || requestModel);
      setLastUsedModel(data.model || requestModel);

      const replyCreatedAt = data.createdAt || new Date().toISOString();
      setMsgs(current => {
        const last = current[current.length - 1];
        const nextReply = {
          id: data.id,
          role: "ai",
          text: data.reply || last?.text || "（抱着你）嗯，我在呢。",
          thinking: data.thinking || null,
          thinkingOpen: false,
          inputTokens: data.inputTokens || 0,
          outputTokens: data.outputTokens || 0,
          createdAt: replyCreatedAt,
          time: formatMsgTime(replyCreatedAt),
        };
        if (last?.role === 'ai') return [...current.slice(0, -1), { ...last, ...nextReply }];
        return [...current, nextReply];
      });
      if (shouldAppendReply) setVisible(value => value + 1);
    } catch (error) {
      if (!isModelUnavailableError(error)) console.error(error);
      setMessageActionError(friendlyGenerationError(error, '重新生成'));
    } finally {
      setThinking(false);
      setRegenerating(false);
    }
  };

  const send = async (modelOverride = '') => {
    if (editingMessage) {
      await saveEditMsg(modelOverride);
      return;
    }
    if ((!input.trim() && !pendingFile) || !sessionId || thinking || messageActionLoading) return;
    const txt = input.trim();
    const requestModel = String(modelOverride || '').trim() || selectedModelRef.current || selectedModel;
    const sendingSessionId = sessionId;
    const fileToSend = pendingFile;
    const isImg = fileToSend && fileToSend.type && fileToSend.type.startsWith('image/');
    const userCreatedAt = new Date().toISOString();
    const temporaryUserId = `temp-user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    chatStickToBottomRef.current = true;
    setMsgs(ms => [...ms, { id: temporaryUserId, role: "me", text: txt, image: isImg ? fileToSend.url : null, file: (fileToSend && !isImg) ? { url: fileToSend.url, name: fileToSend.name } : null, createdAt: userCreatedAt, time: formatMsgTime(userCreatedAt) }]);
    setVisible(v => v + 1);
    setInput("");
    setPendingFile(null);
    setThinking(true);
    setRollbackUndo(null);
    setMessageActionError("");
    try {
      const res = await apiFetch(`${BACKEND}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: txt, model: requestModel, attachment_url: fileToSend?.url || undefined, attachment_type: fileToSend?.type || undefined, attachment_name: fileToSend?.name || undefined })
      });
      const data = await res.json();
      if (sessionIdRef.current !== sendingSessionId) return;
      if (!res.ok) {
        if (data.userMessage?.id) {
          const persistedCreatedAt = data.userMessage.createdAt || userCreatedAt;
          setMsgs(current => current.map(message => message.id === temporaryUserId ? {
            ...message,
            id: data.userMessage.id,
            createdAt: persistedCreatedAt,
            time: formatMsgTime(persistedCreatedAt),
          } : message));
        }
        throw createRequestError(data, "发送失败");
      }
      setLastRequestedModel(data.requestedModel || requestModel);
      setLastUsedModel(data.model || requestModel);
      const replyCreatedAt = data.assistantMessage?.createdAt || data.createdAt || new Date().toISOString();
      const persistedUserCreatedAt = data.userMessage?.createdAt || userCreatedAt;
      setMsgs(ms => [
        ...ms.map(message => message.id === temporaryUserId ? {
          ...message,
          id: data.userMessage?.id || temporaryUserId,
          createdAt: persistedUserCreatedAt,
          time: formatMsgTime(persistedUserCreatedAt),
        } : message),
        {
          id: data.assistantMessage?.id || data.id || `temp-ai-${Date.now()}`,
          role: "ai",
          text: data.reply || "（抱着你）嗯，我在呢。",
          thinking: data.thinking || null,
          thinkingOpen: false,
          inputTokens: data.inputTokens || 0,
          outputTokens: data.outputTokens || 0,
          createdAt: replyCreatedAt,
          time: formatMsgTime(replyCreatedAt),
        },
      ]);
      setVisible(v => v + 1);
    } catch (err) {
      if (!isModelUnavailableError(err)) console.error(err);
      const friendlyError = friendlyGenerationError(err, '重新生成');
      setMessageActionError(friendlyError);
      const errorCreatedAt = new Date().toISOString();
      setMsgs(ms => [...ms, {
        id: `temp-error-${Date.now()}`,
        role: "ai",
        text: isModelUnavailableError(err)
          ? "这个模型暂时没有可用线路。换好模型后，点下面的“重新生成”就能接着聊。"
          : isVisionUnavailableError(err)
            ? friendlyError
            : "连接好像有点问题…消息已经留在这里，可以再试一次。",
        createdAt: errorCreatedAt,
        time: formatMsgTime(errorCreatedAt),
      }]);
      setVisible(v => v + 1);
    } finally {
      setThinking(false);
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
          <div style={{ fontSize: 10, color: C.mutedLight, letterSpacing: ".15em" }}>ourhome · since 2025.03.07</div>
        </div>
      )}

      <div style={{ position: "absolute", inset: 0, zIndex: 40, pointerEvents: "none", background: "radial-gradient(circle at 50% 55%, #FFF8D0 0%, #FFE896 28%, transparent 62%)", opacity: stage === "opening" ? 1 : 0, transition: "opacity .9s ease .3s" }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 30, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: `radial-gradient(ellipse 80% 50% at 50% 100%, ${C.honeyLight} 0%, transparent 65%), ${C.cream}`, opacity: stage === "home" ? 0 : 1, transition: "opacity .9s ease .4s", pointerEvents: stage === "home" ? "none" : "auto" }}>
        <div style={{ fontSize: 10, letterSpacing: ".38em", color: C.muted, textTransform: "uppercase" }}>ourhome · since 2025.03.07</div>
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

      <ChatRoom
        stage={stage}
        view={view}
        C={C}
        leaveRoom={leaveRoom}
        setDrawerOpen={setDrawerOpen}
        setSearchOpen={setSearchOpen}
        setSearchQuery={setSearchQuery}
        setLastSearchQuery={setLastSearchQuery}
        setSearchResults={setSearchResults}
        setSearchMeta={setSearchMeta}
        setSearchScope={setSearchScope}
        thinking={thinking}
        listRef={listRef}
        onListScroll={handleChatScroll}
        bgImage={bgImage}
        bgColor={bgColor}
        ready={ready}
        msgs={msgs}
        visible={visible}
        hasMoreChatHistory={hasMoreChatHistory}
        chatHistoryLoading={chatHistoryLoading}
        loadOlderMessages={loadOlderMessages}
        formatMsgTime={formatMsgTime}
        highlightMsgId={highlightMsgId}
        highlightQuery={highlightQuery}
        myAvatar={myAvatar}
        partnerAvatar={partnerAvatar}
        myBubbleColor={myBubbleColor}
        partnerBubbleColor={partnerBubbleColor}
        toggleThinking={toggleThinking}
        openMessageActions={openMessageActions}
        messageAction={messageAction}
        messageActionLoading={messageActionLoading}
        regenerateLast={regenerateLast}
        regenerating={regenerating}
        editingMessage={editingMessage}
        cancelEditMsg={cancelEditMsg}
        rollbackUndo={rollbackUndo}
        undoRollback={undoRollback}
        sessionTokenPressure={sessionTokenPressure}
        generateCurrentSessionSummary={generateCurrentSessionSummary}
        sessionSummaryLoading={sessionSummaryLoading}
        sessionSummary={sessionSummary}
        messageActionError={messageActionError}
        setMessageActionError={setMessageActionError}
        sessionSummaryError={sessionSummaryError}
        tokenUsageOpen={tokenUsageOpen}
        setTokenUsageOpen={setTokenUsageOpen}
        chatUsage={chatUsage}
        sessionId={sessionId}
        pendingFile={pendingFile}
        imageUploading={imageUploading}
        setPendingFile={setPendingFile}
        chatImageInputRef={chatImageInputRef}
        pickFile={pickFile}
        chatInputRef={chatInputRef}
        input={input}
        setInput={setInput}
        send={send}
        selectedModel={selectedModel}
        chooseModel={chooseModel}
        availableModels={availableModels}
        loadActiveModels={loadActiveModels}
        modelsLoading={modelsLoading}
        modelsError={modelsError}
        refreshMessages={() => loadMessagesFor(sessionId)}
      />

      <LettersRoom
        stage={stage}
        view={view}
        C={C}
        lettersCategory={lettersCategory}
        backToCabin={backToCabin}
        leaveRoom={leaveRoom}
        openCategory={openCategory}
        setView={setView}
        openLetterId={openLetterId}
        setOpenLetterId={setOpenLetterId}
        deleteLetter={deleteLetter}
        letters={letters}
        darkMode={darkMode}
        diarySummariesByDate={diarySummariesByDate}
        repliesByParentId={repliesByParentId}
        replyingToId={replyingToId}
        replyText={replyText}
        setReplyText={setReplyText}
        setReplyingToId={setReplyingToId}
        submitReply={submitReply}
        askAiWrite={askAiWrite}
        aiWriting={aiWriting}
        whisperBgImage={whisperBgImage}
        whisperBgColor={whisperBgColor}
        lettersLoading={lettersLoading}
        orderedRootLetters={orderedRootLetters}
        revealedIds={revealedIds}
        toggleReveal={toggleReveal}
        newLetterTitle={newLetterTitle}
        setNewLetterTitle={setNewLetterTitle}
        selectedPaperStyle={selectedPaperStyle}
        setSelectedPaperStyle={setSelectedPaperStyle}
        newLetterText={newLetterText}
        setNewLetterText={setNewLetterText}
        submitNewLetter={submitNewLetter}
        savingLetter={savingLetter}
        selectedModel={selectedModel}
      />

      <CalendarRoom
        stage={stage}
        view={view}
        C={C}
        leaveRoom={leaveRoom}
        calendarTab={calendarTab}
        setCalendarTab={setCalendarTab}
        calendarMonth={calendarMonth}
        changeMonth={changeMonth}
        monthEntries={monthEntries}
        dayColors={dayColors}
        openDay={openDay}
        setColorPickerDate={setColorPickerDate}
        milestonesLoading={milestonesLoading}
        milestones={milestones}
        deleteMilestoneRemote={deleteMilestoneRemote}
        newMilestoneKind={newMilestoneKind}
        setNewMilestoneKind={setNewMilestoneKind}
        newMilestoneName={newMilestoneName}
        setNewMilestoneName={setNewMilestoneName}
        newMilestoneDate={newMilestoneDate}
        setNewMilestoneDate={setNewMilestoneDate}
        addMilestone={addMilestone}
        scheduleEvents={scheduleEvents}
        deleteScheduleEvent={deleteScheduleEvent}
        newScheduleTitle={newScheduleTitle}
        setNewScheduleTitle={setNewScheduleTitle}
        newScheduleTime={newScheduleTime}
        setNewScheduleTime={setNewScheduleTime}
        createScheduleEvent={createScheduleEvent}
        savingSchedule={savingSchedule}
        notifStatus={notifStatus}
        enablePushNotifications={enablePushNotifications}
        subscribing={subscribing}
        wishes={wishes}
        toggleWish={toggleWish}
        deleteWish={deleteWish}
        newWishText={newWishText}
        setNewWishText={setNewWishText}
        addWish={addWish}
        colorPickerDate={colorPickerDate}
        setDayColor={setDayColor}
        calendarDayOpen={calendarDayOpen}
        setCalendarDayOpen={setCalendarDayOpen}
        dayEntriesLoading={dayEntriesLoading}
        dayEntries={dayEntries}
        editingMoodId={editingMoodId}
        startEditMood={startEditMood}
        deleteMoodEntry={deleteMoodEntry}
        editingMoodText={editingMoodText}
        setEditingMoodText={setEditingMoodText}
        cancelEditMood={cancelEditMood}
        saveEditMood={saveEditMood}
        selectedMood={selectedMood}
        setSelectedMood={setSelectedMood}
        newMoodText={newMoodText}
        setNewMoodText={setNewMoodText}
        askAiWriteMood={askAiWriteMood}
        aiMoodWriting={aiMoodWriting}
        submitMoodEntry={submitMoodEntry}
      />

      <ChatDrawer
        open={drawerOpen}
        theme={C}
        onClose={() => setDrawerOpen(false)}
        createSession={createSession}
        sessions={sessions}
        sessionId={sessionId}
        switchSession={switchSession}
        renameSession={renameSession}
        deleteSession={deleteSession}
      />

      <MemoryRoom
        theme={C}
        visible={stage === "home" && view === "memories"}
        leaveRoom={leaveRoom}
        resetKey={memoryGroupsResetKey}
        systemPromptInput={systemPromptInput}
        setSystemPromptInput={setSystemPromptInput}
        temperatureInput={temperatureInput}
        setTemperatureInput={setTemperatureInput}
        minReplyCharsInput={minReplyCharsInput}
        setMinReplyCharsInput={setMinReplyCharsInput}
        savePersona={savePersona}
        savingPersona={savingPersona}
        newMemory={newMemory}
        setNewMemory={setNewMemory}
        saveMemory={saveMemory}
        savingMemory={savingMemory}
        memoriesLoading={memoriesLoading}
        memories={memories}
        editingMemoryId={editingMemoryId}
        editingMemoryText={editingMemoryText}
        setEditingMemoryText={setEditingMemoryText}
        startEditMemory={startEditMemory}
        cancelEditMemory={cancelEditMemory}
        saveEditMemory={saveEditMemory}
        deleteMemory={deleteMemory}
      />

      <TheaterRoom
        theme={C}
        visible={stage === "home" && view === "theater"}
        leaveRoom={leaveRoom}
        selectedModel={selectedModel}
        availableModels={availableModels}
        mainChatBackground={{ image: bgImage, color: bgColor || "#FDFAF5" }}
      />

      <MusicRoom
        theme={C}
        visible={stage === "home" && view === "music"}
        leaveRoom={leaveRoom}
      />

      <PhotoMemoryRoom
        theme={C}
        visible={stage === "home" && view === "photos"}
        leaveRoom={leaveRoom}
      />

      <MessageActionSheet
        action={messageAction}
        loading={messageActionLoading}
        error={messageActionError}
        theme={C}
        setAction={setMessageAction}
        startEditMessage={startEditMsg}
        confirmRollback={confirmRollback}
      />

      <ChatSearchPanel
        open={searchOpen}
        theme={C}
        query={searchQuery}
        setQuery={setSearchQuery}
        searching={searching}
        results={searchResults}
        scope={searchScope}
        setScope={(nextScope) => {
          setSearchScope(nextScope);
          setSearchResults([]);
          setSearchMeta({ total: 0, page: 1, hasMore: false, mode: 'semantic', semanticAvailable: false });
        }}
        meta={searchMeta}
        lastQuery={lastSearchQuery}
        onClose={() => setSearchOpen(false)}
        onSearch={() => performSearch()}
        onLoadMore={() => performSearch(searchMeta.page + 1, true)}
        onJump={jumpToSearchResult}
      />

      <SettingsRoom
        stage={stage}
        view={view}
        C={C}
        leaveRoom={leaveRoom}
        settingsGroupsResetKey={settingsGroupsResetKey}
        settingsGroupsOpenSignal={settingsGroupsOpenSignal}
        setSettingsGroupsOpenSignal={setSettingsGroupsOpenSignal}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        fontStyle={fontStyle}
        changeFontStyle={changeFontStyle}
        selectedModel={selectedModel}
        modelsLoading={modelsLoading}
        modelsError={modelsError}
        notifStatus={notifStatus}
        notificationMode={isNativeAndroidApp() ? (nativeRemotePushStatus.configured && nativeRemotePushStatus.enabled ? 'native-fcm' : 'native-local') : 'web-push'}
        dailyJournalEnabled={dailyJournalEnabled}
        dailyJournalTime={dailyJournalTime}
        weatherCityInput={weatherCityInput}
        setWeatherCityInput={setWeatherCityInput}
        setWeatherCitySaved={setWeatherCitySaved}
        saveWeatherCity={saveWeatherCity}
        weatherCitySaved={weatherCitySaved}
        homeDayBgImage={homeDayBgImage}
        homeNightBgImage={homeNightBgImage}
        homeMemoBgImage={homeMemoBgImage}
        uploadingHomeBg={uploadingHomeBg}
        uploadHomeBackground={uploadHomeBackground}
        resetHomeBackground={resetHomeBackground}
        homeBgError={homeBgError}
        setDailyJournalEnabled={setDailyJournalEnabled}
        setDailyJournalTime={setDailyJournalTime}
        setDailyJournalSaved={setDailyJournalSaved}
        saveDailyJournalSchedule={saveDailyJournalSchedule}
        dailyJournalSaved={dailyJournalSaved}
        enablePushNotifications={enablePushNotifications}
        subscribing={subscribing}
        myAvatarInputRef={myAvatarInputRef}
        partnerAvatarInputRef={partnerAvatarInputRef}
        uploadingAvatar={uploadingAvatar}
        myAvatar={myAvatar}
        partnerAvatar={partnerAvatar}
        uploadAvatar={uploadAvatar}
        bgImageInputRef={bgImageInputRef}
        bgImage={bgImage}
        uploadingBg={uploadingBg}
        uploadBgImage={uploadBgImage}
        bgColor={bgColor}
        setBackgroundColor={setBackgroundColor}
        resetBackground={resetBackground}
        whisperBgInputRef={whisperBgInputRef}
        whisperBgImage={whisperBgImage}
        uploadingWhisperBg={uploadingWhisperBg}
        uploadWhisperBg={uploadWhisperBg}
        whisperBgColor={whisperBgColor}
        setWhisperBackgroundColor={setWhisperBackgroundColor}
        resetWhisperBackground={resetWhisperBackground}
        myBubbleColor={myBubbleColor}
        partnerBubbleColor={partnerBubbleColor}
        setMyBubble={setMyBubble}
        setPartnerBubble={setPartnerBubble}
        resetBubbleColors={resetBubbleColors}
        setAvailableModels={setAvailableModels}
        normalizeModelOptions={normalizeModelOptions}
        setSelectedModel={applySelectedModel}
        loadActiveModels={loadActiveModels}
        chooseModel={chooseModel}
        exportChatArchive={exportChatArchive}
        exportFullBackup={exportFullBackup}
        settingsExportState={settingsExportState}
      />
    </div>
  );
}
