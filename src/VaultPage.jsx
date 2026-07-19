import { useMemo, useState } from 'react';

const STORAGE_KEY = 'ourhome_cat_vault_v1';

const DEFAULT_DATA = {
  accounts: [
    { id: 'cash', name: '微信零钱', type: 'asset', balance: 368.52, emoji: '💚' },
    { id: 'card', name: '工资卡', type: 'asset', balance: 5200, emoji: '💳' },
    { id: 'alipay', name: '支付宝余额', type: 'asset', balance: 126.8, emoji: '🟦' },
    { id: 'huabei', name: '花呗待还', type: 'debt', balance: 275.43, emoji: '🌸' },
  ],
  transactions: [
    { id: 'seed-1', date: new Date().toISOString().slice(0, 10), type: 'expense', amount: 18, category: '餐饮', accountId: 'cash', tag: '必要', note: '午饭' },
  ],
  goals: [
    { id: 'goal-1', name: '旅行基金', target: 5000, current: 2000, emoji: '✈️' },
  ],
  budget: 1500,
};

const PHRASES = [
  '今天也在认真生活，辛苦啦。',
  '记下来的每一笔，都是你在把日子握回手里。',
  '少一点糊涂账，多一点安心。',
  '小金库又长大了一点点。',
  '不责怪今天的花销，我们只负责看清它。',
];

const money = (value) => Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.accounts ? saved : DEFAULT_DATA;
  } catch {
    return DEFAULT_DATA;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function VaultPage({ onClose }) {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState('home');
  const [showForm, setShowForm] = useState(false);
  const [phrase, setPhrase] = useState(PHRASES[0]);
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    category: '餐饮',
    accountId: data.accounts[0]?.id || '',
    tag: '必要',
    note: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const commit = (next) => {
    setData(next);
    saveData(next);
  };

  const totals = useMemo(() => {
    const assets = data.accounts.filter((x) => x.type === 'asset').reduce((sum, x) => sum + Number(x.balance), 0);
    const debt = data.accounts.filter((x) => x.type === 'debt').reduce((sum, x) => sum + Number(x.balance), 0);
    const month = new Date().toISOString().slice(0, 7);
    const monthRows = data.transactions.filter((x) => x.date.startsWith(month));
    const income = monthRows.filter((x) => x.type === 'income').reduce((sum, x) => sum + Number(x.amount), 0);
    const expense = monthRows.filter((x) => x.type === 'expense').reduce((sum, x) => sum + Number(x.amount), 0);
    const unnecessary = monthRows.filter((x) => x.type === 'expense' && x.tag === '非必要').reduce((sum, x) => sum + Number(x.amount), 0);
    return { assets, debt, net: assets - debt, income, expense, unnecessary };
  }, [data]);

  const submitTransaction = (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0 || !form.accountId) return;

    const transaction = { ...form, amount, id: crypto.randomUUID() };
    const accounts = data.accounts.map((account) => {
      if (account.id !== form.accountId) return account;
      let delta = form.type === 'income' ? amount : -amount;
      if (account.type === 'debt') delta = form.type === 'expense' ? amount : -amount;
      return { ...account, balance: Number(account.balance) + delta };
    });

    const next = { ...data, accounts, transactions: [transaction, ...data.transactions] };
    commit(next);
    setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    setForm((old) => ({ ...old, amount: '', note: '' }));
    setShowForm(false);
  };

  const deleteTransaction = (row) => {
    const accounts = data.accounts.map((account) => {
      if (account.id !== row.accountId) return account;
      let delta = row.type === 'income' ? -Number(row.amount) : Number(row.amount);
      if (account.type === 'debt') delta = row.type === 'expense' ? -Number(row.amount) : Number(row.amount);
      return { ...account, balance: Number(account.balance) + delta };
    });
    commit({ ...data, accounts, transactions: data.transactions.filter((x) => x.id !== row.id) });
  };

  const addGoalMoney = (goalId) => {
    const raw = window.prompt('这次存入多少元？');
    const amount = Number(raw);
    if (!amount || amount <= 0) return;
    commit({
      ...data,
      goals: data.goals.map((goal) => goal.id === goalId ? { ...goal, current: Number(goal.current) + amount } : goal),
    });
  };

  const shell = {
    position: 'fixed', inset: 0, zIndex: 9999, background: '#FFF8F0', color: '#2E1F12',
    fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', display: 'flex', flexDirection: 'column',
  };
  const card = { background: '#FFFDF8', border: '1px solid #EFE4CC', borderRadius: 18, boxShadow: '0 6px 20px rgba(78,46,16,.06)' };
  const softButton = { border: '1px solid #EFD8A6', background: '#FFF3D6', color: '#9A621A', borderRadius: 12, padding: '9px 13px', cursor: 'pointer', fontWeight: 650 };

  return (
    <div style={shell}>
      <header style={{ padding: '14px 16px 10px', background: '#FFFDF8', borderBottom: '1px solid #EFE4CC' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={onClose} style={{ ...softButton, padding: '7px 11px' }}>← 回家</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '.12em' }}>猫の金库</div>
            <div style={{ fontSize: 10, color: '#B89A6A', letterSpacing: '.25em', marginTop: 3 }}>OUR LITTLE VAULT</div>
          </div>
          <button onClick={() => setShowForm(true)} style={{ ...softButton, width: 40, height: 36, padding: 0, fontSize: 22 }}>＋</button>
        </div>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 100px' }}>
        {tab === 'home' && (
          <>
            <section style={{ ...card, padding: 20, background: 'linear-gradient(145deg,#FFF7DE,#F8DFAB)' }}>
              <div style={{ color: '#9A7A50', fontSize: 12 }}>净资产</div>
              <div style={{ fontSize: 34, fontWeight: 850, marginTop: 5 }}>¥ {money(totals.net)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
                <div style={{ background: 'rgba(255,255,255,.58)', borderRadius: 13, padding: 12 }}><div style={{ fontSize: 11, color: '#9A7A50' }}>本月收入</div><b style={{ color: '#5D8C62' }}>＋¥ {money(totals.income)}</b></div>
                <div style={{ background: 'rgba(255,255,255,.58)', borderRadius: 13, padding: 12 }}><div style={{ fontSize: 11, color: '#9A7A50' }}>本月支出</div><b style={{ color: '#C36F5C' }}>－¥ {money(totals.expense)}</b></div>
              </div>
            </section>

            <h3 style={{ margin: '22px 4px 10px', fontSize: 15 }}>我的账户</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {data.accounts.map((account) => (
                <div key={account.id} style={{ ...card, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: '#FFF3D6', fontSize: 21 }}>{account.emoji}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{account.name}</div><div style={{ fontSize: 11, color: '#B89A6A' }}>{account.type === 'debt' ? '负债账户' : '资产账户'}</div></div>
                  <b style={{ color: account.type === 'debt' ? '#C36F5C' : '#2E1F12' }}>¥ {money(account.balance)}</b>
                </div>
              ))}
            </div>

            <h3 style={{ margin: '22px 4px 10px', fontSize: 15 }}>本月预算</h3>
            <section style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span>已用 ¥ {money(totals.expense)}</span><span>预算 ¥ {money(data.budget)}</span></div>
              <div style={{ height: 10, borderRadius: 99, background: '#F2E7D2', overflow: 'hidden', marginTop: 10 }}>
                <div style={{ height: '100%', width: `${Math.min(100, totals.expense / Math.max(1, data.budget) * 100)}%`, background: 'linear-gradient(90deg,#E8B45A,#DD9A33)' }} />
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#9A7A50' }}>非必要支出 ¥ {money(totals.unnecessary)}</div>
            </section>

            <section style={{ ...card, padding: 18, marginTop: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#B89A6A', letterSpacing: '.18em' }}>老公的话</div>
              <div style={{ marginTop: 10, lineHeight: 1.8 }}>“{phrase}”</div>
            </section>
          </>
        )}

        {tab === 'records' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><h3 style={{ margin: 0 }}>收支记录</h3><button onClick={() => setShowForm(true)} style={softButton}>记一笔</button></div>
            <div style={{ display: 'grid', gap: 10 }}>
              {data.transactions.length === 0 && <div style={{ ...card, padding: 30, textAlign: 'center', color: '#B89A6A' }}>还没有记录，第一笔就从今天开始。</div>}
              {data.transactions.map((row) => {
                const account = data.accounts.find((x) => x.id === row.accountId);
                return (
                  <div key={row.id} style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 42, textAlign: 'center', fontSize: 22 }}>{row.type === 'income' ? '🌱' : '🧾'}</div>
                    <div style={{ flex: 1 }}><b>{row.note || row.category}</b><div style={{ fontSize: 11, color: '#B89A6A', marginTop: 4 }}>{row.date} · {account?.name || '未知账户'} · {row.tag || ''}</div></div>
                    <div style={{ textAlign: 'right' }}><b style={{ color: row.type === 'income' ? '#5D8C62' : '#C36F5C' }}>{row.type === 'income' ? '+' : '-'}¥ {money(row.amount)}</b><div><button onClick={() => deleteTransaction(row)} style={{ border: 0, background: 'transparent', color: '#C7A77A', cursor: 'pointer', fontSize: 11, marginTop: 5 }}>删除</button></div></div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'goals' && (
          <>
            <h3 style={{ marginTop: 0 }}>存钱目标</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {data.goals.map((goal) => {
                const percent = Math.min(100, Number(goal.current) / Math.max(1, Number(goal.target)) * 100);
                return (
                  <section key={goal.id} style={{ ...card, padding: 17 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{goal.emoji} {goal.name}</b><span style={{ color: '#9A621A' }}>{percent.toFixed(0)}%</span></div>
                    <div style={{ height: 11, borderRadius: 99, background: '#F2E7D2', overflow: 'hidden', margin: '12px 0 8px' }}><div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg,#F0C878,#DD9A33)' }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#9A7A50' }}><span>¥ {money(goal.current)} / ¥ {money(goal.target)}</span><button onClick={() => addGoalMoney(goal.id)} style={softButton}>存一点</button></div>
                  </section>
                );
              })}
            </div>
          </>
        )}

        {tab === 'stats' && (
          <>
            <h3 style={{ marginTop: 0 }}>本月统计</h3>
            <section style={{ ...card, padding: 18 }}>
              <StatRow label="收入" value={totals.income} total={Math.max(totals.income, totals.expense)} symbol="＋" />
              <StatRow label="支出" value={totals.expense} total={Math.max(totals.income, totals.expense)} symbol="－" />
              <StatRow label="非必要" value={totals.unnecessary} total={Math.max(1, totals.expense)} symbol="" />
            </section>
          </>
        )}
      </main>

      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: 'rgba(255,253,248,.96)', borderTop: '1px solid #EFE4CC', padding: '8px 8px max(8px,env(safe-area-inset-bottom))', backdropFilter: 'blur(12px)' }}>
        {[['home','🏠','总览'],['records','🧾','明细'],['stats','📊','统计'],['goals','🎯','目标']].map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ border: 0, background: tab === key ? '#FFF3D6' : 'transparent', color: tab === key ? '#9A621A' : '#9A8262', borderRadius: 12, padding: '7px 2px', cursor: 'pointer' }}><div style={{ fontSize: 19 }}>{icon}</div><div style={{ fontSize: 10, marginTop: 2 }}>{label}</div></button>
        ))}
      </nav>

      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(36,24,12,.35)', display: 'flex', alignItems: 'flex-end' }}>
          <form onSubmit={submitTransaction} onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#FFFDF8', borderRadius: '24px 24px 0 0', padding: '20px 18px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0 }}>记一笔</h3><button type="button" onClick={() => setShowForm(false)} style={{ border: 0, background: 'transparent', fontSize: 22 }}>×</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <Choice active={form.type === 'expense'} onClick={() => setForm({ ...form, type: 'expense' })}>支出</Choice>
              <Choice active={form.type === 'income'} onClick={() => setForm({ ...form, type: 'income' })}>收入</Choice>
            </div>
            <Field label="金额"><input required inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" style={inputStyle} /></Field>
            <Field label="日期"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} /></Field>
            <Field label="分类"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>{['餐饮','交通','购物','住房','娱乐','工资','红包','其他'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="账户"><select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} style={inputStyle}>{data.accounts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
            {form.type === 'expense' && <Field label="标签"><select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} style={inputStyle}><option>必要</option><option>非必要</option></select></Field>}
            <Field label="备注"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="这笔钱花在哪里" style={inputStyle} /></Field>
            <button type="submit" style={{ width: '100%', marginTop: 20, border: 0, borderRadius: 14, padding: 14, background: 'linear-gradient(135deg,#E8B45A,#C8892A)', color: '#fff', fontWeight: 800, fontSize: 15 }}>保存记录</button>
          </form>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #E9D8B8', borderRadius: 12, padding: '11px 12px', background: '#FFFDF8', fontSize: 14, color: '#2E1F12' };

function Field({ label, children }) {
  return <label style={{ display: 'block', marginTop: 14 }}><div style={{ fontSize: 12, color: '#9A7A50', marginBottom: 6 }}>{label}</div>{children}</label>;
}

function Choice({ active, onClick, children }) {
  return <button type="button" onClick={onClick} style={{ border: `1px solid ${active ? '#D69A39' : '#E9D8B8'}`, borderRadius: 12, padding: 11, background: active ? '#FFF0C9' : '#FFFDF8', color: active ? '#9A621A' : '#8D7658', fontWeight: 750 }}>{children}</button>;
}

function StatRow({ label, value, total, symbol }) {
  const percent = Math.min(100, Number(value) / Math.max(1, Number(total)) * 100);
  return <div style={{ marginBottom: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{label}</span><b>{symbol}¥ {money(value)}</b></div><div style={{ height: 9, borderRadius: 99, background: '#F2E7D2', overflow: 'hidden', marginTop: 8 }}><div style={{ height: '100%', width: `${percent}%`, background: 'linear-gradient(90deg,#F0C878,#DD9A33)' }} /></div></div>;
}
