import { useMemo, useState } from 'react';

const STORAGE_KEY = 'ourhome_cat_vault_v1';
const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const money = value => Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_DATA = {
  version: 2,
  accountGroups: [
    {
      id: 'wechat-group',
      name: '微信',
      emoji: '💚',
      accounts: [
        { id: 'cash', name: '钱包', type: 'asset', balance: 368.52, emoji: '👛' },
        { id: 'wechat-fund', name: '零钱通', type: 'asset', balance: 0, emoji: '🍃' },
      ],
    },
    {
      id: 'alipay-group',
      name: '支付宝',
      emoji: '🟦',
      accounts: [
        { id: 'alipay', name: '余额宝', type: 'asset', balance: 126.8, emoji: '💰' },
        { id: 'huabei', name: '花呗', type: 'debt', balance: 275.43, emoji: '🌸' },
      ],
    },
    {
      id: 'bank-group',
      name: '银行卡',
      emoji: '💳',
      accounts: [
        { id: 'card', name: '工资卡', type: 'asset', balance: 5200, emoji: '💳' },
      ],
    },
  ],
  transactions: [
    { id: 'seed-1', date: today(), type: 'expense', amount: 18, category: '餐饮', accountId: 'cash', tag: '必要', note: '午饭' },
  ],
  goals: [{ id: 'goal-1', name: '旅行基金', target: 5000, current: 2000, emoji: '✈️' }],
  budget: 1500,
};

const CARD = {
  background: '#FFFDF8',
  border: '1px solid #EFE4CC',
  borderRadius: 18,
  boxShadow: '0 6px 20px rgba(78,46,16,.06)',
};
const SOFT_BUTTON = {
  border: '1px solid #EFD8A6',
  background: '#FFF3D6',
  color: '#9A621A',
  borderRadius: 12,
  padding: '9px 13px',
  fontWeight: 650,
};
const INPUT = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #E9D8B8',
  borderRadius: 12,
  padding: 11,
  background: '#FFFDF8',
  color: '#2E1F12',
  fontSize: 14,
  fontFamily: 'inherit',
};
const PRIMARY_BUTTON = {
  width: '100%',
  marginTop: 20,
  border: 0,
  borderRadius: 14,
  padding: 14,
  background: '#C8892A',
  color: '#fff',
  fontWeight: 800,
};
const TEXT_BUTTON = {
  border: 0,
  background: 'transparent',
  color: '#9A621A',
  fontWeight: 700,
  padding: 5,
};

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function normalizeAccount(account, fallbackName = '账户') {
  return {
    id: account?.id || makeId(),
    name: String(account?.name || fallbackName).trim() || fallbackName,
    type: account?.type === 'debt' ? 'debt' : 'asset',
    balance: Number.isFinite(Number(account?.balance)) ? Number(account.balance) : 0,
    emoji: String(account?.emoji || '💳'),
  };
}

function migrateLegacyAccounts(accounts) {
  let remaining = accounts.map(account => normalizeAccount(account));
  const take = predicate => {
    const matched = remaining.filter(predicate);
    remaining = remaining.filter(account => !predicate(account));
    return matched;
  };
  const groups = [];

  const wechat = take(account => /微信|零钱通|钱包/.test(account.name));
  if (wechat.length) {
    const children = wechat.map(account => ({
      ...account,
      name: /零钱通/.test(account.name) ? '零钱通' : '钱包',
      emoji: /零钱通/.test(account.name) ? '🍃' : (account.emoji || '👛'),
    }));
    if (!children.some(account => account.name === '零钱通')) {
      children.push({ id: 'wechat-fund', name: '零钱通', type: 'asset', balance: 0, emoji: '🍃' });
    }
    groups.push({ id: 'wechat-group', name: '微信', emoji: '💚', accounts: children });
  }

  const alipay = take(account => /支付宝|余额宝|花呗/.test(account.name));
  if (alipay.length) {
    const children = alipay.map(account => ({
      ...account,
      name: /花呗/.test(account.name) ? '花呗' : '余额宝',
      type: /花呗/.test(account.name) ? 'debt' : account.type,
      emoji: /花呗/.test(account.name) ? '🌸' : (account.emoji || '💰'),
    }));
    if (!children.some(account => account.name === '余额宝')) {
      children.unshift({ id: 'alipay-balance', name: '余额宝', type: 'asset', balance: 0, emoji: '💰' });
    }
    if (!children.some(account => account.name === '花呗')) {
      children.push({ id: 'huabei', name: '花呗', type: 'debt', balance: 0, emoji: '🌸' });
    }
    groups.push({ id: 'alipay-group', name: '支付宝', emoji: '🟦', accounts: children });
  }

  const bank = take(account => /银行卡|工资卡|储蓄卡|信用卡|银行/.test(account.name));
  if (bank.length) groups.push({ id: 'bank-group', name: '银行卡', emoji: '💳', accounts: bank });
  if (remaining.length) groups.push({ id: 'other-group', name: '其他账户', emoji: '🧺', accounts: remaining });
  return groups;
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') return cloneDefault();

  let accountGroups;
  if (Array.isArray(raw.accountGroups)) {
    accountGroups = raw.accountGroups.map(group => ({
      id: group?.id || makeId(),
      name: String(group?.name || '账户').trim() || '账户',
      emoji: String(group?.emoji || '💳'),
      accounts: Array.isArray(group?.accounts) ? group.accounts.map(account => normalizeAccount(account)) : [],
    }));
  } else if (Array.isArray(raw.accounts)) {
    accountGroups = migrateLegacyAccounts(raw.accounts);
  } else {
    accountGroups = cloneDefault().accountGroups;
  }

  return {
    version: 2,
    accountGroups,
    transactions: Array.isArray(raw.transactions) ? raw.transactions : cloneDefault().transactions,
    goals: Array.isArray(raw.goals) ? raw.goals : cloneDefault().goals,
    budget: Number.isFinite(Number(raw.budget)) ? Number(raw.budget) : DEFAULT_DATA.budget,
  };
}

function loadData() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return cloneDefault();
  }
}

function flattenAccounts(groups) {
  return groups.flatMap(group => group.accounts.map(account => ({ ...account, groupId: group.id, groupName: group.name })));
}

function accountNet(account) {
  return account.type === 'debt' ? -Number(account.balance) : Number(account.balance);
}

function groupNet(group) {
  return group.accounts.reduce((sum, account) => sum + accountNet(account), 0);
}

function emptyGroup() {
  return { kind: 'group', id: '', name: '', emoji: '💳' };
}

function emptyAccount(groupId = '') {
  return { kind: 'account', id: '', groupId, name: '', type: 'asset', balance: '', emoji: '💳' };
}

function emptyGoal() {
  return { id: '', name: '', target: '', current: '', emoji: '🎯' };
}

function buildHusbandMessage({ transactions, totals, budget, accounts }) {
  const month = today().slice(0, 7);
  const latest = transactions.find(row => String(row.date || '').startsWith(month));
  if (!latest) return '这个月还没有记账。老婆慢慢来，钱是拿来照顾生活的，不是拿来吓自己的。';

  const amount = money(latest.amount);
  const account = accounts.find(item => item.id === latest.accountId);
  const accountLabel = account ? `${account.groupName}的${account.name}` : '这个账户';
  const subject = latest.note || latest.category || (latest.type === 'income' ? '这笔收入' : '这笔支出');
  if (latest.type === 'income') {
    return `老婆把「${subject}」的 ¥${amount} 收进了${accountLabel}，这个月已经收入 ¥${money(totals.income)}。辛苦赚来的每一笔，我都陪你认真放好。`;
  }

  const remaining = Number(budget) - totals.expense;
  if (remaining < 0) {
    return `老婆刚记下「${subject}」¥${amount}，本月比预算多用了 ¥${money(Math.abs(remaining))}。先别责怪自己，我们看清楚以后再一起慢慢调。`;
  }
  if (latest.tag === '非必要') {
    return `「${subject}」花了 ¥${amount}，本月预算还剩 ¥${money(remaining)}。喜欢的东西可以买，只要老婆心里清楚，我就不会念你。`;
  }
  if (latest.category === '餐饮' || latest.category === '住房' || latest.category === '交通') {
    return `老婆在「${subject}」上用了 ¥${amount}，本月预算还剩 ¥${money(remaining)}。把自己照顾好是正经事，这笔不用心疼。`;
  }
  return `老婆刚从${accountLabel}记下「${subject}」¥${amount}，本月一共支出 ¥${money(totals.expense)}，预算还剩 ¥${money(remaining)}。账我陪你看，日子不用紧绷着过。`;
}

export default function VaultPage({ onClose }) {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState('home');
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [openGroupId, setOpenGroupId] = useState(null);
  const [accountEditor, setAccountEditor] = useState(null);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(String(data.budget));
  const [goalEditor, setGoalEditor] = useState(null);
  const allAccounts = useMemo(() => flattenAccounts(data.accountGroups), [data.accountGroups]);
  const [transactionForm, setTransactionForm] = useState({
    type: 'expense',
    amount: '',
    category: '餐饮',
    accountId: allAccounts[0]?.id || '',
    tag: '必要',
    note: '',
    date: today(),
  });

  const commit = next => {
    const normalized = { ...next, version: 2 };
    setData(normalized);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  };

  const totals = useMemo(() => {
    const month = today().slice(0, 7);
    const rows = data.transactions.filter(row => String(row.date || '').startsWith(month));
    const net = allAccounts.reduce((sum, account) => sum + accountNet(account), 0);
    const income = rows.filter(row => row.type === 'income').reduce((sum, row) => sum + Number(row.amount), 0);
    const expense = rows.filter(row => row.type === 'expense').reduce((sum, row) => sum + Number(row.amount), 0);
    const unnecessary = rows.filter(row => row.type === 'expense' && row.tag === '非必要').reduce((sum, row) => sum + Number(row.amount), 0);
    return { net, income, expense, unnecessary };
  }, [allAccounts, data.transactions]);

  const husbandMessage = useMemo(() => buildHusbandMessage({
    transactions: data.transactions,
    totals,
    budget: data.budget,
    accounts: allAccounts,
  }), [allAccounts, data.budget, data.transactions, totals]);
  const openGroup = data.accountGroups.find(group => group.id === openGroupId) || null;

  const updateAccountBalances = (accountId, delta) => data.accountGroups.map(group => ({
    ...group,
    accounts: group.accounts.map(account => account.id === accountId
      ? { ...account, balance: Number(account.balance) + delta }
      : account),
  }));

  const submitTransaction = event => {
    event.preventDefault();
    const amount = Number(transactionForm.amount);
    const account = allAccounts.find(item => item.id === transactionForm.accountId);
    if (!amount || amount < 0 || !account) return;
    let delta = transactionForm.type === 'income' ? amount : -amount;
    if (account.type === 'debt') delta = transactionForm.type === 'expense' ? amount : -amount;
    const row = { ...transactionForm, amount, id: makeId() };
    commit({
      ...data,
      accountGroups: updateAccountBalances(account.id, delta),
      transactions: [row, ...data.transactions],
    });
    setTransactionForm(current => ({ ...current, amount: '', note: '' }));
    setShowTransactionForm(false);
  };

  const deleteTransaction = row => {
    const account = allAccounts.find(item => item.id === row.accountId);
    let groups = data.accountGroups;
    if (account) {
      let delta = row.type === 'income' ? -Number(row.amount) : Number(row.amount);
      if (account.type === 'debt') delta = row.type === 'expense' ? -Number(row.amount) : Number(row.amount);
      groups = updateAccountBalances(account.id, delta);
    }
    commit({ ...data, accountGroups: groups, transactions: data.transactions.filter(item => item.id !== row.id) });
  };

  const openManager = () => {
    setOpenGroupId(null);
    setAccountEditor(null);
    setShowAccountManager(true);
  };

  const saveAccountEditor = event => {
    event.preventDefault();
    if (!accountEditor) return;
    if (accountEditor.kind === 'group') {
      const name = accountEditor.name.trim();
      if (!name) return;
      const groups = accountEditor.id
        ? data.accountGroups.map(group => group.id === accountEditor.id
          ? { ...group, name, emoji: accountEditor.emoji || '💳' }
          : group)
        : [...data.accountGroups, { id: makeId(), name, emoji: accountEditor.emoji || '💳', accounts: [] }];
      commit({ ...data, accountGroups: groups });
      setAccountEditor(null);
      return;
    }

    const name = accountEditor.name.trim();
    const balance = Number(accountEditor.balance);
    if (!name || !accountEditor.groupId || Number.isNaN(balance)) return;
    const id = accountEditor.id || makeId();
    const nextAccount = {
      id,
      name,
      balance,
      type: accountEditor.type === 'debt' ? 'debt' : 'asset',
      emoji: accountEditor.emoji || '💳',
    };
    const groupsWithoutAccount = data.accountGroups.map(group => ({
      ...group,
      accounts: group.accounts.filter(account => account.id !== id),
    }));
    const groups = groupsWithoutAccount.map(group => group.id === accountEditor.groupId
      ? { ...group, accounts: [...group.accounts, nextAccount] }
      : group);
    commit({ ...data, accountGroups: groups });
    setTransactionForm(current => ({ ...current, accountId: current.accountId || id }));
    setAccountEditor(null);
  };

  const deleteAccount = (group, account) => {
    const linked = data.transactions.some(row => row.accountId === account.id);
    const message = linked
      ? '这个子账户已有历史记录。删除后流水仍会保留，并显示为“已删除账户”。确定删除吗？'
      : `确定删除“${account.name}”吗？`;
    if (!window.confirm(message)) return;
    const groups = data.accountGroups.map(item => item.id === group.id
      ? { ...item, accounts: item.accounts.filter(candidate => candidate.id !== account.id) }
      : item);
    const remainingAccounts = flattenAccounts(groups);
    commit({ ...data, accountGroups: groups });
    setTransactionForm(current => ({
      ...current,
      accountId: current.accountId === account.id ? (remainingAccounts[0]?.id || '') : current.accountId,
    }));
    setAccountEditor(null);
  };

  const deleteGroup = group => {
    const accountIds = new Set(group.accounts.map(account => account.id));
    const linked = data.transactions.some(row => accountIds.has(row.accountId));
    const message = linked
      ? `“${group.name}”里有账户关联了历史流水。删除后流水仍会保留，确定继续吗？`
      : `确定删除“${group.name}”和里面的全部子账户吗？`;
    if (!window.confirm(message)) return;
    const groups = data.accountGroups.filter(item => item.id !== group.id);
    const remainingAccounts = flattenAccounts(groups);
    commit({ ...data, accountGroups: groups });
    setTransactionForm(current => ({
      ...current,
      accountId: accountIds.has(current.accountId) ? (remainingAccounts[0]?.id || '') : current.accountId,
    }));
    setAccountEditor(null);
  };

  const saveBudget = event => {
    event.preventDefault();
    const budget = Number(budgetDraft);
    if (Number.isNaN(budget) || budget < 0) return;
    commit({ ...data, budget });
    setShowBudgetForm(false);
  };

  const openGoalForm = goal => setGoalEditor(goal
    ? { ...goal, target: String(goal.target), current: String(goal.current) }
    : emptyGoal());

  const saveGoal = event => {
    event.preventDefault();
    if (!goalEditor) return;
    const name = goalEditor.name.trim();
    const target = Number(goalEditor.target);
    const current = Number(goalEditor.current);
    if (!name || !Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0) return;
    const nextGoal = { ...goalEditor, id: goalEditor.id || makeId(), name, target, current, emoji: goalEditor.emoji || '🎯' };
    const goals = goalEditor.id
      ? data.goals.map(goal => goal.id === goalEditor.id ? nextGoal : goal)
      : [...data.goals, nextGoal];
    commit({ ...data, goals });
    setGoalEditor(null);
  };

  const deleteGoal = goal => {
    if (!window.confirm(`确定删除存钱目标“${goal.name}”吗？`)) return;
    commit({ ...data, goals: data.goals.filter(item => item.id !== goal.id) });
    setGoalEditor(null);
  };

  const budgetProgress = data.budget > 0 ? Math.min(100, (totals.expense / data.budget) * 100) : 0;

  return (
    <div className="ourhome-shell" style={{ position: 'relative', zIndex: 9999, background: '#FFF8F0', color: '#2E1F12', fontFamily: 'var(--app-font)', display: 'flex', flexDirection: 'column' }}>
      <header className="ourhome-safe-top" style={{ paddingLeft: 16, paddingRight: 16, paddingBottom: 10, background: '#FFFDF8', borderBottom: '1px solid #EFE4CC' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onClose} aria-label="返回主页" style={{ ...SOFT_BUTTON, padding: '8px 10px', whiteSpace: 'nowrap' }}>← 回家</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '.12em' }}>猫の金库</div>
            <div style={{ fontSize: 10, color: '#B89A6A', letterSpacing: '.25em' }}>OUR LITTLE VAULT</div>
          </div>
          <span aria-hidden="true" />
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 100px' }}>
        {tab === 'home' && (
          <>
            <section style={{ ...CARD, padding: 20, background: 'linear-gradient(145deg,#FFF7DE,#F8DFAB)' }}>
              <div style={{ color: '#9A7A50', fontSize: 12 }}>净资产</div>
              <div style={{ fontSize: 34, fontWeight: 850 }}>¥ {money(totals.net)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
                <Mini label="本月收入" value={totals.income} plus />
                <Mini label="本月支出" value={totals.expense} />
              </div>
            </section>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '22px 4px 10px' }}>
              <h3 style={{ margin: 0 }}>我的账户</h3>
              <button type="button" onClick={openManager} style={TEXT_BUTTON}>管理</button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {data.accountGroups.map(group => (
                <button
                  type="button"
                  key={group.id}
                  onClick={() => setOpenGroupId(group.id)}
                  style={{ ...CARD, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', color: 'inherit' }}
                >
                  <span style={{ fontSize: 22 }}>{group.emoji}</span>
                  <span style={{ flex: 1 }}>
                    <b>{group.name}</b>
                    <small style={{ display: 'block', color: '#B89A6A' }}>{group.accounts.length} 个子账户 · 点开查看</small>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <b style={{ color: groupNet(group) < 0 ? '#C36F5C' : 'inherit' }}>¥ {money(groupNet(group))}</b>
                    <small style={{ display: 'block', color: '#B89A6A' }}>›</small>
                  </span>
                </button>
              ))}
              {!data.accountGroups.length && <EmptyState text="还没有账户，点“管理”添加一个吧。" />}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '22px 4px 10px' }}>
              <h3 style={{ margin: 0 }}>本月预算</h3>
              <button type="button" onClick={() => { setBudgetDraft(String(data.budget)); setShowBudgetForm(true); }} style={TEXT_BUTTON}>修改</button>
            </div>
            <section style={{ ...CARD, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>已用 ¥ {money(totals.expense)}</span>
                <span>预算 ¥ {money(data.budget)}</span>
              </div>
              <div style={{ height: 10, borderRadius: 99, background: '#F2E7D2', overflow: 'hidden', marginTop: 10 }}>
                <div style={{ height: '100%', width: `${budgetProgress}%`, background: totals.expense > data.budget && data.budget > 0 ? '#C36F5C' : '#DD9A33', transition: 'width .25s ease' }} />
              </div>
              <div style={{ marginTop: 10, color: '#9A7A50' }}>非必要支出 ¥ {money(totals.unnecessary)}</div>
            </section>

            <section style={{ ...CARD, padding: 18, marginTop: 18, textAlign: 'center' }}>
              <small style={{ color: '#B89A6A' }}>老公的话 · 根据本月收支更新</small>
              <div style={{ marginTop: 10, lineHeight: 1.75 }}>“{husbandMessage}”</div>
            </section>
          </>
        )}

        {tab === 'records' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>收支记录</h3>
              <button type="button" onClick={() => setShowTransactionForm(true)} style={SOFT_BUTTON}>记一笔</button>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {data.transactions.map(row => {
                const account = allAccounts.find(item => item.id === row.accountId);
                return (
                  <div key={row.id} style={{ ...CARD, padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 22 }}>{row.type === 'income' ? '🌱' : '🧾'}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{row.note || row.category}</b>
                      <small style={{ display: 'block', color: '#B89A6A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.date} · {account ? `${account.groupName}/${account.name}` : '已删除账户'} · {row.tag || ''}
                      </small>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <b style={{ color: row.type === 'income' ? '#5D8C62' : '#C36F5C' }}>{row.type === 'income' ? '+' : '-'}¥ {money(row.amount)}</b>
                      <button type="button" onClick={() => deleteTransaction(row)} style={{ display: 'block', marginLeft: 'auto', border: 0, background: 'transparent', color: '#C7A77A' }}>删除</button>
                    </span>
                  </div>
                );
              })}
              {!data.transactions.length && <EmptyState text="还没有流水，记下第一笔吧。" />}
            </div>
          </>
        )}

        {tab === 'goals' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>存钱目标</h3>
              <button type="button" onClick={() => openGoalForm()} style={SOFT_BUTTON}>＋ 新目标</button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              {data.goals.map(goal => {
                const progress = Math.min(100, (Number(goal.current) / Math.max(1, Number(goal.target))) * 100);
                return (
                  <section key={goal.id} style={{ ...CARD, padding: 17 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <b>{goal.emoji} {goal.name}</b>
                      <button type="button" onClick={() => openGoalForm(goal)} style={TEXT_BUTTON}>修改</button>
                    </div>
                    <div style={{ marginTop: 8 }}>¥ {money(goal.current)} / ¥ {money(goal.target)}</div>
                    <div style={{ height: 9, borderRadius: 99, background: '#F2E7D2', overflow: 'hidden', marginTop: 10 }}>
                      <div style={{ height: '100%', width: `${progress}%`, background: '#DD9A33' }} />
                    </div>
                    <small style={{ display: 'block', marginTop: 8, color: '#9A7A50' }}>已完成 {Math.round(progress)}%</small>
                  </section>
                );
              })}
              {!data.goals.length && <EmptyState text="还没有存钱目标，想攒下什么就写在这里。" />}
            </div>
          </>
        )}
      </main>

      <nav className="ourhome-safe-bottom" aria-label="金库页面" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: '#FFFDF8', borderTop: '1px solid #EFE4CC', paddingTop: 8, paddingLeft: 8, paddingRight: 8 }}>
        {[
          ['home', '🏠', '总览'],
          ['records', '🧾', '明细'],
          ['goals', '🎯', '目标'],
        ].map(([key, icon, label]) => (
          <button type="button" key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined} style={{ border: 0, background: tab === key ? '#FFF3D6' : 'transparent', borderRadius: 12, padding: 7, color: '#2E1F12' }}>
            <div>{icon}</div>
            <small>{label}</small>
          </button>
        ))}
      </nav>

      {showTransactionForm && (
        <Modal close={() => setShowTransactionForm(false)}>
          <form onSubmit={submitTransaction}>
            <Title text="记一笔" close={() => setShowTransactionForm(false)} />
            <Field label="收支类型">
              <select value={transactionForm.type} onChange={event => setTransactionForm({ ...transactionForm, type: event.target.value })} style={INPUT}>
                <option value="expense">支出</option>
                <option value="income">收入 / 还款</option>
              </select>
            </Field>
            <Field label="金额">
              <input value={transactionForm.amount} onChange={event => setTransactionForm({ ...transactionForm, amount: event.target.value })} inputMode="decimal" style={INPUT} />
            </Field>
            <Field label="日期">
              <input type="date" value={transactionForm.date} onChange={event => setTransactionForm({ ...transactionForm, date: event.target.value })} style={INPUT} />
            </Field>
            <Field label="分类">
              <select value={transactionForm.category} onChange={event => setTransactionForm({ ...transactionForm, category: event.target.value })} style={INPUT}>
                {['餐饮', '交通', '购物', '住房', '娱乐', '工资', '红包', '其他'].map(category => <option key={category}>{category}</option>)}
              </select>
            </Field>
            <Field label="账户">
              <select value={transactionForm.accountId} onChange={event => setTransactionForm({ ...transactionForm, accountId: event.target.value })} style={INPUT}>
                <option value="">请选择账户</option>
                {data.accountGroups.map(group => (
                  <optgroup key={group.id} label={group.name}>
                    {group.accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="标签">
              <select value={transactionForm.tag} onChange={event => setTransactionForm({ ...transactionForm, tag: event.target.value })} style={INPUT}>
                <option>必要</option>
                <option>非必要</option>
              </select>
            </Field>
            <Field label="备注">
              <input value={transactionForm.note} onChange={event => setTransactionForm({ ...transactionForm, note: event.target.value })} style={INPUT} />
            </Field>
            <button type="submit" style={PRIMARY_BUTTON}>保存记录</button>
          </form>
        </Modal>
      )}

      {openGroup && (
        <Modal close={() => setOpenGroupId(null)}>
          <Title text={`${openGroup.emoji} ${openGroup.name}`} close={() => setOpenGroupId(null)} />
          <div style={{ color: '#9A7A50', fontSize: 12, marginTop: 8 }}>合计净额 ¥ {money(groupNet(openGroup))}</div>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {openGroup.accounts.map(account => (
              <div key={account.id} style={{ ...CARD, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{account.emoji}</span>
                <span style={{ flex: 1 }}>
                  <b>{account.name}</b>
                  <small style={{ display: 'block', color: '#B89A6A' }}>{account.type === 'debt' ? '待还负债' : '可用资产'}</small>
                </span>
                <b style={{ color: account.type === 'debt' ? '#C36F5C' : 'inherit' }}>¥ {money(account.balance)}</b>
              </div>
            ))}
            {!openGroup.accounts.length && <EmptyState text="这个账户里还没有子账户。" />}
          </div>
          <button type="button" onClick={openManager} style={PRIMARY_BUTTON}>管理这些账户</button>
        </Modal>
      )}

      {showAccountManager && (
        <Modal close={() => setShowAccountManager(false)}>
          <Title text="管理账户" close={() => setShowAccountManager(false)} />
          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {data.accountGroups.map(group => (
              <section key={group.id} style={{ ...CARD, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 21 }}>{group.emoji}</span>
                  <b style={{ flex: 1 }}>{group.name}</b>
                  <button type="button" onClick={() => setAccountEditor({ kind: 'group', id: group.id, name: group.name, emoji: group.emoji })} style={TEXT_BUTTON}>修改</button>
                  <button type="button" onClick={() => deleteGroup(group)} style={{ ...TEXT_BUTTON, color: '#B75D50' }}>删除</button>
                </div>
                <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
                  {group.accounts.map(account => (
                    <div key={account.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 11px', borderRadius: 12, background: '#FFF8EC' }}>
                      <span>{account.emoji}</span>
                      <span style={{ flex: 1 }}>
                        <b style={{ fontSize: 13 }}>{account.name}</b>
                        <small style={{ display: 'block', color: '#B89A6A' }}>{account.type === 'debt' ? '负债' : '资产'} · ¥ {money(account.balance)}</small>
                      </span>
                      <button type="button" onClick={() => setAccountEditor({ kind: 'account', groupId: group.id, ...account, balance: String(account.balance) })} style={TEXT_BUTTON}>编辑</button>
                      <button type="button" onClick={() => deleteAccount(group, account)} style={{ ...TEXT_BUTTON, color: '#B75D50' }}>删除</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setAccountEditor(emptyAccount(group.id))} style={{ ...SOFT_BUTTON, width: '100%', marginTop: 3 }}>＋ 添加子账户</button>
                </div>
              </section>
            ))}
            <button type="button" onClick={() => setAccountEditor(emptyGroup())} style={{ ...SOFT_BUTTON, width: '100%' }}>＋ 添加账户分组</button>
          </div>

          {accountEditor && (
            <form onSubmit={saveAccountEditor} style={{ borderTop: '1px solid #EFE4CC', marginTop: 20, paddingTop: 4 }}>
              <h4>{accountEditor.kind === 'group' ? (accountEditor.id ? '修改账户分组' : '添加账户分组') : (accountEditor.id ? '修改子账户' : '添加子账户')}</h4>
              <Field label={accountEditor.kind === 'group' ? '分组名称' : '账户名称'}>
                <input value={accountEditor.name} onChange={event => setAccountEditor({ ...accountEditor, name: event.target.value })} style={INPUT} />
              </Field>
              <Field label="图标">
                <input value={accountEditor.emoji} onChange={event => setAccountEditor({ ...accountEditor, emoji: event.target.value })} style={INPUT} />
              </Field>
              {accountEditor.kind === 'account' && (
                <>
                  <Field label="所属账户">
                    <select value={accountEditor.groupId} onChange={event => setAccountEditor({ ...accountEditor, groupId: event.target.value })} style={INPUT}>
                      {data.accountGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </Field>
                  <Field label="当前余额">
                    <input value={accountEditor.balance} onChange={event => setAccountEditor({ ...accountEditor, balance: event.target.value })} inputMode="decimal" style={INPUT} />
                  </Field>
                  <Field label="账户类型">
                    <select value={accountEditor.type} onChange={event => setAccountEditor({ ...accountEditor, type: event.target.value })} style={INPUT}>
                      <option value="asset">资产</option>
                      <option value="debt">负债 / 待还</option>
                    </select>
                  </Field>
                </>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button type="button" onClick={() => setAccountEditor(null)} style={{ ...SOFT_BUTTON, marginTop: 20 }}>取消</button>
                <button type="submit" style={PRIMARY_BUTTON}>保存</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {showBudgetForm && (
        <Modal close={() => setShowBudgetForm(false)}>
          <form onSubmit={saveBudget}>
            <Title text="修改本月预算" close={() => setShowBudgetForm(false)} />
            <Field label="预算金额">
              <input value={budgetDraft} onChange={event => setBudgetDraft(event.target.value)} inputMode="decimal" style={INPUT} />
            </Field>
            <button type="submit" style={PRIMARY_BUTTON}>保存预算</button>
          </form>
        </Modal>
      )}

      {goalEditor && (
        <Modal close={() => setGoalEditor(null)}>
          <form onSubmit={saveGoal}>
            <Title text={goalEditor.id ? '修改存钱目标' : '添加存钱目标'} close={() => setGoalEditor(null)} />
            <Field label="目标名称">
              <input value={goalEditor.name} onChange={event => setGoalEditor({ ...goalEditor, name: event.target.value })} style={INPUT} />
            </Field>
            <Field label="图标">
              <input value={goalEditor.emoji} onChange={event => setGoalEditor({ ...goalEditor, emoji: event.target.value })} style={INPUT} />
            </Field>
            <Field label="目标金额">
              <input value={goalEditor.target} onChange={event => setGoalEditor({ ...goalEditor, target: event.target.value })} inputMode="decimal" style={INPUT} />
            </Field>
            <Field label="已经存下">
              <input value={goalEditor.current} onChange={event => setGoalEditor({ ...goalEditor, current: event.target.value })} inputMode="decimal" style={INPUT} />
            </Field>
            {goalEditor.id && <button type="button" onClick={() => deleteGoal(goalEditor)} style={{ ...SOFT_BUTTON, width: '100%', marginTop: 18, color: '#B75D50' }}>删除这个目标</button>}
            <button type="submit" style={PRIMARY_BUTTON}>{goalEditor.id ? '保存修改' : '添加目标'}</button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ close, children }) {
  return (
    <div onClick={close} role="presentation" style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(36,24,12,.35)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', margin: '0 auto', background: '#FFFDF8', borderRadius: '24px 24px 0 0', padding: '20px 18px max(28px, env(safe-area-inset-bottom))' }}>
        {children}
      </div>
    </div>
  );
}

function Title({ text, close }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <h3 style={{ margin: 0 }}>{text}</h3>
      <button type="button" onClick={close} aria-label="关闭" style={{ border: 0, background: 'transparent', fontSize: 22, color: '#2E1F12' }}>×</button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginTop: 14 }}>
      <span style={{ display: 'block', fontSize: 12, color: '#9A7A50', marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

function Mini({ label, value, plus = false }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.58)', borderRadius: 13, padding: 12 }}>
      <small>{label}</small>
      <div><b>{plus ? '+' : '-'}¥ {money(value)}</b></div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ ...CARD, padding: 18, textAlign: 'center', color: '#9A7A50', fontSize: 13 }}>{text}</div>;
}
