from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


room_path = Path('src/LuzePrivateRoom.jsx')
room = room_path.read_text()

room = replace_once(
    room,
    """const KIND_LABELS = {
  trail: '搜索足迹',
  note: '学习笔记',
  idea: '奇思妙想',
};
""",
    """const KIND_LABELS = {
  trail: '搜索足迹',
  note: '学习笔记',
  idea: '奇思妙想',
};
const TABS = [
  ['trail', '足迹'],
  ['note', '学习笔记'],
  ['idea', '奇思妙想'],
];
const SHANGHAI_CLOCK_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const SHANGHAI_DATE_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const SHANGHAI_FOLDER_LABEL_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});
""",
    'hoist static tabs and Shanghai formatters',
)

room = replace_once(
    room,
    """function clock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(/\\//g, '.');
}

function shanghaiDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function folderDateLabel(key) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(key)) return '时间未标记';
  const date = new Date(`${key}T00:00:00+08:00`);
  return date.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}
""",
    """function clock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return SHANGHAI_CLOCK_FORMATTER.format(date).replace(/\\//g, '.');
}

function shanghaiDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const parts = SHANGHAI_DATE_PARTS_FORMATTER.formatToParts(date);
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function folderDateLabel(key) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(key)) return '时间未标记';
  return SHANGHAI_FOLDER_LABEL_FORMATTER.format(new Date(`${key}T00:00:00+08:00`));
}
""",
    'reuse Shanghai formatters',
)

room = replace_once(
    room,
    """function DailyFolderList({ kind, items }) {
  const folders = groupEntriesByDay(items);
  return (
    <section className=\"luze-daily-folders\" aria-label={`${KIND_LABELS[kind]}按日期整理`}>
      {folders.map((folder, index) => (
        <details className={`luze-day-folder luze-day-folder--${kind}`} key={`${kind}-${folder.date}`} open={index === 0}>
          <summary>
            <span className=\"luze-folder-clip\" aria-hidden=\"true\">⌁</span>
            <span className=\"luze-folder-date\">
              <strong>{folder.label}</strong>
              <small>{folder.date.replace(/-/g, '.')} · {folder.items.length} 条{KIND_LABELS[kind]}</small>
            </span>
            <span className=\"luze-folder-chevron\" aria-hidden=\"true\">⌄</span>
          </summary>
          <div className=\"luze-folder-body\"><FolderContents kind={kind} items={folder.items} /></div>
        </details>
      ))}
    </section>
  );
}
""",
    """function DailyFolder({ kind, folder, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={`luze-day-folder luze-day-folder--${kind}`}
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className=\"luze-folder-clip\" aria-hidden=\"true\">⌁</span>
        <span className=\"luze-folder-date\">
          <strong>{folder.label}</strong>
          <small>{folder.date.replace(/-/g, '.')} · {folder.items.length} 条{KIND_LABELS[kind]}</small>
        </span>
        <span className=\"luze-folder-chevron\" aria-hidden=\"true\">⌄</span>
      </summary>
      {open && <div className=\"luze-folder-body\"><FolderContents kind={kind} items={folder.items} /></div>}
    </details>
  );
}

function DailyFolderList({ kind, items }) {
  const folders = useMemo(() => groupEntriesByDay(items), [items]);
  return (
    <section className=\"luze-daily-folders\" aria-label={`${KIND_LABELS[kind]}按日期整理`}>
      {folders.map((folder, index) => (
        <DailyFolder key={`${kind}-${folder.date}`} kind={kind} folder={folder} defaultOpen={index === 0} />
      ))}
    </section>
  );
}
""",
    'lazy render closed daily folders',
)

room = replace_once(
    room,
    """  const tabs = [
    ['trail', '足迹'],
    ['note', '学习笔记'],
    ['idea', '奇思妙想'],
  ];

""",
    "",
    'remove per-render tab allocation',
)
room = replace_once(room, "{tabs.map(([key, label]) => (", "{TABS.map(([key, label]) => (", 'reuse static tabs')
room_path.write_text(room)


test_path = Path('scripts/data-room-polish-regression.test.mjs')
test = test_path.read_text()
test = replace_once(test, "assert.match(room, /open=\\{index === 0\\}/);", "assert.match(room, /defaultOpen=\\{index === 0\\}/);", 'update latest-folder assertion')
test = replace_once(
    test,
    """  assert.match(room, /LuzeDailyFolders\\.css/);
});
""",
    """  assert.match(room, /LuzeDailyFolders\\.css/);
});

test('closed Luze day folders avoid mounting old card trees', () => {
  assert.match(room, /function DailyFolder\\(/);
  assert.match(room, /const \\[open, setOpen\\] = useState\\(defaultOpen\\)/);
  assert.match(room, /onToggle=\\{event => setOpen\\(event\\.currentTarget\\.open\\)\\}/);
  assert.match(room, /\\{open && <div className=\"luze-folder-body\">/);
  assert.match(room, /useMemo\\(\\(\\) => groupEntriesByDay\\(items\\), \\[items\\]\\)/);
  assert.match(room, /SHANGHAI_CLOCK_FORMATTER/);
  assert.match(room, /SHANGHAI_DATE_PARTS_FORMATTER/);
  assert.match(room, /SHANGHAI_FOLDER_LABEL_FORMATTER/);
});
""",
    'add folder rendering regression',
)
test_path.write_text(test)
