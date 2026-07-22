const DAY_MS = 86_400_000;

export const MILESTONE_KINDS = {
  anniversary: { label: '纪念日', emoji: '✦' },
  birthday: { label: '生日', emoji: '🎂' },
  festival: { label: '节日', emoji: '♡' },
};

const BUILT_IN_LOVE_DATES = [
  { id: 'festival-valentine', label: '情人节', month: 2, day: 14, emoji: '♡', kind: 'festival' },
  { id: 'festival-520', label: '520', month: 5, day: 20, emoji: '♡', kind: 'festival' },
];

function dayStamp(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseDateKey(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) return null;
  return date;
}

export function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function daysFrom(from, to) {
  return Math.round((dayStamp(to) - dayStamp(from)) / DAY_MS);
}

function occurrenceInYear(month, day, year) {
  const result = new Date(year, month - 1, day, 12);
  if (result.getMonth() !== month - 1) result.setDate(0);
  return result;
}

function nextAnnualOccurrence(month, day, now) {
  let occurrence = occurrenceInYear(month, day, now.getFullYear());
  if (daysFrom(now, occurrence) < 0) occurrence = occurrenceInYear(month, day, now.getFullYear() + 1);
  return occurrence;
}

export function milestoneKind(milestone) {
  const label = String(milestone?.label || '');
  if (milestone?.emoji === '🎂' || /生日|诞辰/.test(label)) return 'birthday';
  if (milestone?.emoji === '♡' || /情人节|七夕|520|节日|圣诞|元旦/.test(label)) return 'festival';
  return 'anniversary';
}

export function milestoneDisplay(milestone, now = new Date()) {
  const date = parseDateKey(milestone?.date);
  if (!date) return null;
  const delta = daysFrom(now, date);
  const kind = milestoneKind(milestone);
  const nextOccurrence = nextAnnualOccurrence(date.getMonth() + 1, date.getDate(), now);
  const nextDays = daysFrom(now, nextOccurrence);

  if (delta > 0) {
    return { kind, state: 'future', value: delta, unit: '天', kicker: '离这一天还有', nextDays: delta, nextDate: date };
  }
  if (delta === 0) {
    return { kind, state: 'today', value: '今天', unit: '', kicker: '就是这一天', nextDays: 0, nextDate: date };
  }
  if (kind !== 'anniversary') {
    if (nextDays === 0) {
      return { kind, state: 'today', value: '今天', unit: '', kicker: '就是这一天', nextDays, nextDate: nextOccurrence };
    }
    return { kind, state: 'future', value: nextDays, unit: '天', kicker: '离这一天还有', nextDays, nextDate: nextOccurrence };
  }
  return {
    kind,
    state: 'past',
    value: Math.abs(delta) + 1,
    unit: '天',
    kicker: '一起走过',
    nextDays,
    nextDate: nextOccurrence,
  };
}

export function upcomingOccasions(milestones, now = new Date(), withinDays = 10) {
  const custom = (Array.isArray(milestones) ? milestones : []).flatMap(milestone => {
    const date = parseDateKey(milestone?.date);
    if (!date) return [];
    const originalDays = daysFrom(now, date);
    const target = originalDays >= 0
      ? date
      : nextAnnualOccurrence(date.getMonth() + 1, date.getDate(), now);
    const days = daysFrom(now, target);
    if (days < 0 || days > withinDays) return [];
    return [{
      id: `milestone-${milestone.id}`,
      label: milestone.label,
      emoji: milestone.emoji || MILESTONE_KINDS[milestoneKind(milestone)].emoji,
      kind: milestoneKind(milestone),
      days,
      date: formatDateKey(target),
      source: 'milestone',
    }];
  });

  const customLabels = new Set(custom.map(item => String(item.label).replace(/\s/g, '').toLowerCase()));
  const builtIn = BUILT_IN_LOVE_DATES.flatMap(item => {
    if (customLabels.has(item.label.replace(/\s/g, '').toLowerCase())) return [];
    const target = nextAnnualOccurrence(item.month, item.day, now);
    const days = daysFrom(now, target);
    if (days > withinDays) return [];
    return [{ ...item, days, date: formatDateKey(target), source: 'festival' }];
  });

  return [...custom, ...builtIn].sort((a, b) => a.days - b.days || a.label.localeCompare(b.label, 'zh-CN'));
}

export function occasionReminderText(occasion) {
  if (!occasion) return '';
  return occasion.days === 0
    ? `今天是「${occasion.label}」♡`
    : `「${occasion.label}」还有 ${occasion.days} 天`;
}
