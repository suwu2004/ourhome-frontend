import { useEffect, useState } from 'react';
import App from './App.jsx';
import VaultPage from './VaultPage.jsx';

const rooms = [
  { key: 'chat', icon: '💬', title: '聊天', subtitle: '回到我们的客厅' },
  { key: 'letters', icon: '💌', title: '时光信差', subtitle: '把心事寄给未来' },
  { key: 'memories', icon: '📖', title: '记忆', subtitle: '收藏我们的故事' },
  { key: 'calendar', icon: '📅', title: '心情日历', subtitle: '记录每一天的颜色' },
  { key: 'vault', icon: '🐱', title: '猫の金库', subtitle: '一起把日子攒起来' },
  { key: 'settings', icon: '⚙️', title: '设置', subtitle: '装饰我们的家' },
];

const roomKeys = new Set(rooms.map(room => room.key));

function roomFromHash() {
  const key = window.location.hash.replace(/^#/, '');
  return roomKeys.has(key) ? key : 'home';
}

function HomeHub({ onOpen }) {
  return (
    <div className="ourhome-shell ourhome-scroll" style={{ overflowY: 'auto', background: 'linear-gradient(180deg,#FFF8F0 0%,#FFFDF8 55%,#FFF4E2 100%)', color: '#2E1F12', padding: 'max(28px,env(safe-area-inset-top)) 18px max(28px,env(safe-area-inset-bottom))' }}>
      <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '24px 0 30px' }}>
          <div style={{ fontSize: 13, color: '#B89A6A', letterSpacing: '.32em', marginLeft: '.32em' }}>OUR HOME</div>
          <h1 style={{ margin: '12px 0 7px', fontSize: 30, letterSpacing: '.08em' }}>欢迎回家</h1>
          <p style={{ margin: 0, color: '#9A7A50', fontSize: 14 }}>今天想先去哪个房间？</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 13 }}>
          {rooms.map(room => (
            <button key={room.key} type="button" onClick={() => onOpen(room.key)} style={{ minHeight: 142, border: '1px solid #EFE4CC', borderRadius: 24, padding: '20px 15px', background: '#FFFDF8', color: 'inherit', textAlign: 'left', boxShadow: '0 9px 28px rgba(78,46,16,.07)', cursor: 'pointer', position: 'relative' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 17, background: '#FFF3D6', fontSize: 25, marginBottom: 15 }}>{room.icon}</span>
              <strong style={{ display: 'block', fontSize: 17, marginBottom: 6 }}>{room.title}</strong>
              <small style={{ color: '#B89A6A', lineHeight: 1.5 }}>{room.subtitle}</small>
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 26, color: '#C2A77B', fontSize: 12 }}>🏡 叶檀与陆泽的小家</div>
      </div>
    </div>
  );
}

export default function Root() {
  const [room, setRoom] = useState(roomFromHash);

  useEffect(() => {
    const syncRoom = () => setRoom(roomFromHash());
    window.addEventListener('hashchange', syncRoom);
    window.addEventListener('popstate', syncRoom);
    return () => {
      window.removeEventListener('hashchange', syncRoom);
      window.removeEventListener('popstate', syncRoom);
    };
  }, []);

  const openRoom = key => {
    window.location.hash = key;
    setRoom(key);
  };

  const goHome = () => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    setRoom('home');
  };

  if (room === 'vault') return <VaultPage onClose={goHome} />;
  if (room !== 'home') return <App key={room} initialView={room} onHome={goHome} />;

  return <HomeHub onOpen={openRoom} />;
}
