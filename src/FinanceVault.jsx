import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'ourhome_finance_v1';

const DEFAULT_ACCOUNTS = [
  { id: 'cash', name: '微信零钱', icon: '💚', type: 'asset', balance: 0 },
  { id: 'bank', name: '银行卡', icon: '💳', type: 'asset', balance: 0 },
  { id: 'alipay', name: '支付宝', icon: '🔵', type: 'asset', balance: 0 },
  { id: 'huabei', name: '花呗', icon: '🌸', type: 'liability', balance: 0 },
];

const EXPENSE_CATEGORIES = ['餐饮', '交通', '住房', '水电', '购物', '医疗', '学习', '娱乐', '订阅', '人情', '其他'];
const INCOME_CATEGORIES = ['工资', '兼职', '红包', '退款', '利息', '其他'];

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function money(value) {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.accounts) && Array.isArray(saved.transactions)) return saved;
  } catch {}
  return { accounts: DEFAULT_ACCOUNTS, transactions: [] };
}

function husbandNote({ monthExpense, monthIncome, nonEssential, totalAsset }) {
  if (monthExpense === 0 && monthIncome === 0) return '小金库刚刚开门。第一笔账不用完美，记下来就已经很棒了。';
  if (monthIncome > 0 && monthExpense <= monthIncome * 0.5) return '这个月的钱袋守得很稳。辛苦赚来的钱，有一部分正在替你保护未来。';
  if (nonEssential > monthExpense * 0.45 && monthExpense > 0) return '非必要消费有一点点多啦。先不责怪自己，我们只是把钱的脚印看清楚。';
  if (totalAsset < 0) return '现在只是暂时欠了一点。我们从下一笔开始慢慢整理，不让数字吓到你。';
  return '每记下一笔，生活就清楚一点。钱不是用来责备你的，是用来照顾你的。';
}

export default function FinanceVault({ onBack }) {
  const [data, setData] = useState(loadState);
  const [tab, setTab] = useState('overview');
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [form, setForm] = useState({ type: 'expense', amount: '', accountId: 'cash', category: '餐饮', necessity: 'necessary', note: '', date: today() });
  const [accountForm, setAccountForm] = useState({ name: '', icon: '💳', type: 'asset', balance: '' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const summary = useMemo(() => {
    const month = today().slice(0, 7);
    const monthTx = data.transactions.filter(t => t.date?.startsWith(month));
    const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const nonEssential = monthTx.filter(t => t.type === 'expense' && t.necessity === 'nonessential').reduce((s, t) => s + Number(t.amount), 0);
    const assets = data.accounts.filter(a => a.type === 'asset').reduce((s, a) => s + Number(a.balance), 0);
    const liabilities = data.accounts.filter(a => a.type === 'liability').reduce((s, a) => s + Number(a.balance), 0);
    return { monthIncome, monthExpense, nonEssential, totalAsset: assets - liabilities, assets, liabilities };
  }, [data]);

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  function addTransaction(e) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    const tx = { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), ...form, amount };
    setData(prev => ({
      ...prev,
      transactions: [tx, ...prev.transactions],
      accounts: prev.accounts.map(a => {
        if (a.id !== form.accountId) return a;
        if (form.type === 'income') return { ...a, balance: Number(a.balance) + amount };
        if (form.type === 'expense') {
          const delta = a.type === 'liability' ? amount : -amount;
          return { ...a, balance: Number(a.balance) + delta };
        }
        return a;
      }),
    }));
    setForm(prev => ({ ...prev, amount: '', note: '' }));
    setTab('records');
  }

  function deleteTransaction(tx) {
    setData(prev => ({
      ...prev,
      transactions: prev.transactions.filter(t => t.id !== tx.id),
      accounts: prev.accounts.map(a => {
        if (a.id !== tx.accountId) return a;
        if (tx.type === 'income') return { ...a, balance: Number(a.balance) - Number(tx.amount) };
        if (tx.type === 'expense') {
          const delta = a.type === 'liability' ? -Number(tx.amount) : Number(tx.amount);
          return { ...a, balance: Number(a.balance) + delta };
        }
        return a;
      }),
    }));
  }

  function addAccount(e) {
    e.preventDefault();
    if (!accountForm.name.trim()) return;
    setData(prev => ({
      ...prev,
      accounts: [...prev.accounts, { id: String(Date.now()), ...accountForm, name: accountForm.name.trim(), balance: Number(accountForm.balance || 0) }],
    }));
    setAccountForm({ name: '', icon: '💳', type: 'asset', balance: '' });
    setShowAccountForm(false);
  }

  const styles = {
    page: { minHeight: '100vh', background: '#FFF8F0', color: '#2E1F12', fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', paddingBottom: 86 },
    header: { position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(255,253,248,.95)', borderBottom: '1px solid #EFE4CC', backdropFilter: 'blur(10px)' },
    card: { background: '#FFFDF8', border: '1px solid #EFE4CC', borderRadius: 18, boxShadow: '0 8px 24px rgba(185,122,31,.08)' },
    button: { border: 0, borderRadius: 999, padding: '10px 16px', background: 'linear-gradient(135deg,#E8B45A,#B97A1F)', color: '#fff', fontWeight: 700, cursor: 'pointer' },
    input: { width: '100%', boxSizing: 'border-box', border: '1px solid #EFE4CC', borderRadius: 12, padding: '11px 12px', background: '#fff', color: '#2E1F12', fontSize: 14, outline: 'none' },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <button onClick={onBack} style={{ border: 0, background: 'transparent', fontSize: 21, cursor: 'pointer', color: '#B97A1F' }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>猫の金库</div>
          <div style={{ fontSize: 11, color: '#B89A6A', marginTop: 2 }}>叶檀和陆泽的生活账本</div>
        </div>
        <span style={{ fontSize: 24 }}>🐱</span>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: 14 }}>
        {tab === 'overview' && (
          <>
            <section style={{ ...styles.card, padding: 20, background: 'linear-gradient(145deg,#FFF3D6,#FFFDF8)' }}>
              <div style={{ fontSize: 12, color: '#B89A6A' }}>当前净资产</div>
              <div style={{ fontSize: 34, fontWeight: 850, margin: '7px 0 15px' }}>¥ {money(summary.totalAsset)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><div style={{ fontSize: 11, color: '#B89A6A' }}>本月收入</div><div style={{ fontSize: 17, fontWeight: 750, color: '#5E9B67' }}>+ ¥ {money(summary.monthIncome)}</div></div>
                <div><div style={{ fontSize: 11, color: '#B89A6A' }}>本月支出</div><div style={{ fontSize: 17, fontWeight: 750, color: '#D27562' }}>- ¥ {money(summary.monthExpense)}</div></div>
              </div>
            </section>

            <section style={{ ...styles.card, padding: 16, marginTop: 14 }}>
              <div style={{ fontSize: 13, color: '#B97A1F', fontWeight: 800, marginBottom: 8 }}>💌 老公的话</div>
              <div style={{ fontSize: 14, lineHeight: 1.75 }}>{husbandNote(summary)}</div>
            </section>

            <section style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <b>我的账户</b>
                <button onClick={() => setShowAccountForm(v => !v)} style={{ ...styles.button, padding: '7px 12px', fontSize: 12 }}>＋ 添加</button>
              </div>
              {showAccountForm && (
                <form onSubmit={addAccount} style={{ ...styles.card, padding: 14, marginBottom: 12, display: 'grid', gap: 9 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 8 }}>
                    <input style={styles.input} value={accountForm.icon} onChange={e => setAccountForm({ ...accountForm, icon: e.target.value })} maxLength={2} />
                    <input style={styles.input} placeholder="账户名称" value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} />
                  </div>
                  <select style={styles.input} value={accountForm.type} onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}><option value="asset">资产账户</option><option value="liability">负债账户</option></select>
                  <input style={styles.input} type="number" step="0.01" placeholder="当前余额" value={accountForm.balance} onChange={e => setAccountForm({ ...accountForm, balance: e.target.value })} />
                  <button style={styles.button}>保存账户</button>
                </form>
              )}
              <div style={{ display: 'grid', gap: 10 }}>
                {data.accounts.map(a => (
                  <div key={a.id} style={{ ...styles.card, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 14, background: '#FFF3D6', display: 'grid', placeItems: 'center', fontSize: 22 }}>{a.icon}</div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 750 }}>{a.name}</div><div style={{ fontSize: 11, color: '#B89A6A' }}>{a.type === 'liability' ? '待还负债' : '可用资产'}</div></div>
                    <b style={{ color: a.type === 'liability' ? '#D27562' : '#2E1F12' }}>¥ {money(a.balance)}</b>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'add' && (
          <form onSubmit={addTransaction} style={{ ...styles.card, padding: 16, display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['expense', 'income'].map(type => <button type="button" key={type} onClick={() => setForm({ ...form, type, category: type === 'income' ? '工资' : '餐饮' })} style={{ ...styles.button, background: form.type === type ? 'linear-gradient(135deg,#E8B45A,#B97A1F)' : '#F7EDD8', color: form.type === type ? '#fff' : '#8B6B42' }}>{type === 'expense' ? '支出' : '收入'}</button>)}
            </div>
            <input style={{ ...styles.input, fontSize: 24, fontWeight: 800 }} type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            <select style={styles.input} value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}>{data.accounts.map(a => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}</select>
            <select style={styles.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select>
            {form.type === 'expense' && <select style={styles.input} value={form.necessity} onChange={e => setForm({ ...form, necessity: e.target.value })}><option value="necessary">必要消费</option><option value="nonessential">非必要消费</option></select>}
            <input style={styles.input} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            <input style={styles.input} placeholder="备注，比如：午饭、公交、会员续费" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            <button style={styles.button}>记下这一笔</button>
          </form>
        )}

        {tab === 'records' && (
          <section>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>收支记录</div>
            {data.transactions.length === 0 ? <div style={{ ...styles.card, padding: 28, textAlign: 'center', color: '#B89A6A' }}>还没有记录，先记下第一笔吧。</div> : data.transactions.map(tx => {
              const account = data.accounts.find(a => a.id === tx.accountId);
              return <div key={tx.id} style={{ ...styles.card, padding: 14, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: tx.type === 'income' ? '#EAF6E8' : '#FDE8E0', display: 'grid', placeItems: 'center' }}>{tx.type === 'income' ? '🌱' : '🧾'}</div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 750 }}>{tx.category}{tx.note ? ` · ${tx.note}` : ''}</div><div style={{ fontSize: 11, color: '#B89A6A' }}>{tx.date} · {account?.name || '未知账户'}{tx.type === 'expense' ? ` · ${tx.necessity === 'necessary' ? '必要' : '非必要'}` : ''}</div></div>
                <div style={{ textAlign: 'right' }}><b style={{ color: tx.type === 'income' ? '#5E9B67' : '#D27562' }}>{tx.type === 'income' ? '+' : '-'} ¥ {money(tx.amount)}</b><div onClick={() => deleteTransaction(tx)} style={{ fontSize: 10, color: '#B89A6A', marginTop: 5, cursor: 'pointer' }}>删除</div></div>
              </div>;
            })}
          </section>
        )}
      </main>

      <nav style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 12, width: 'calc(100% - 28px)', maxWidth: 690, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, padding: 7, background: 'rgba(255,253,248,.96)', border: '1px solid #EFE4CC', borderRadius: 20, boxShadow: '0 10px 30px rgba(80,50,20,.16)', backdropFilter: 'blur(12px)' }}>
        {[['overview','🏠','总览'],['add','＋','记一笔'],['records','📒','明细']].map(([key, icon, label]) => <button key={key} onClick={() => setTab(key)} style={{ border: 0, borderRadius: 15, padding: '8px 4px', background: tab === key ? '#FFF3D6' : 'transparent', color: tab === key ? '#B97A1F' : '#8B6B42', fontWeight: 750, cursor: 'pointer' }}><div style={{ fontSize: 18 }}>{icon}</div><div style={{ fontSize: 10, marginTop: 2 }}>{label}</div></button>)}
      </nav>
    </div>
  );
}
