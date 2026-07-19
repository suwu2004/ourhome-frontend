import { useState } from 'react';
import App from './App.jsx';
import VaultPage from './VaultPage.jsx';

const rooms = [
  { key: 'chat', icon: '💬', title: '聊天', subtitle: '回到我们的客厅', ready: true },
  { key: 'post', icon: '💌', title: '时光信差', subtitle: '把心事寄给未来', ready: false },
  { key: 'memories', icon: '📖', title: '记忆', subtitle: '收藏我们的故事', ready: false },
  { key: 'calendar', icon: '📅', title: '心情日历', subtitle: '记录每一天的颜色', ready: false },
  { key: 'vault', icon: '🐱', title: '猫の金库', subtitle: '一起把日子攒起来', ready: true },
  { key: 'settings', icon: '⚙️', title: '设置', subtitle: '装饰我们的家', ready: false },
];

function HomeHub({ onOpen }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(180deg,#FFF8F0 0%,#FFFDF8 55%,#FFF4E2 100%)', color: '#2E1F12', fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', padding: 'max(28px,env(safe-area-inset-top)) 18px max(28px,env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '24px 0 30px' }}>
          <div style={{ fontSize: 13, color: '#B89A6A', letterSpacing: '.32em', marginLeft: '.32em' }}>OUR HOME</div>
          <h1 style={{ margin: '12px 0 7px', fontSize: 30, letterSpacing: '.08em' }}>欢迎回家</h1>
          <p style={{ margin: 0, color: '#9A7A50', fontSize: 14 }}>今天想先去哪个房间？</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 13 }}>
          {rooms.map(room => (
            <button
              key={room.key}
              type="button"
              onClick={() => onOpen(room.key)}
              style={{ minHeight: 142, border: '1px solid #EFE4CC', borderRadius: 24, padding: '20px 15px', background: '#FFFDF8', color: 'inherit', textAlign: 'left', boxShadow: '0 9px 28px rgba(78,46,16,.07)', cursor: 'pointer', position: 'relative' }}
            >
              <span style={{ display: 'grid', placeItems: 'center', width: 48, height: 48, borderRadius: 17, background: '#FFF3D6', fontSize: 25, marginBottom: 15 }}>{room.icon}</span>
              <strong style={{ display: 'block', fontSize: 17, marginBottom: 6 }}>{room.title}</strong>
              <small style={{ color: '#B89A6A', lineHeight: 1.5 }}>{room.subtitle}</small>
              {!room.ready && <span style={{ position: 'absolute', top: 13, right: 13, fontSize: 10, color: '#A87934', background: '#FFF3D6', borderRadius: 99, padding: '4px 7px' }}>整理中</span>}
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 26, color: '#C2A77B', fontSize: 12 }}>🏡 叶檀与陆泽的小家</div>
      </div>
    </div>
  );
}

export default function Root() {
  const [room, setRoom] = useState('home');

  if (room === 'chat') return <App />;
  if (room === 'vault') return <VaultPage onClose={() => setRoom('home')} />;

  return <HomeHub onOpen={(key) => {
    if (key === 'chat' || key === 'vault') setRoom(key);
    else setRoom('chat');
  }} />;
}
