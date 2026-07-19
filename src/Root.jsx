import { useState } from 'react';
import App from './App.jsx';
import VaultPage from './VaultPage.jsx';

export default function Root() {
  const [showVault, setShowVault] = useState(false);

  return (
    <>
      <App />
      {!showVault && (
        <button
          type="button"
          aria-label="打开猫の金库"
          onClick={() => setShowVault(true)}
          style={{
            position: 'fixed',
            right: 18,
            bottom: 22,
            zIndex: 9998,
            width: 54,
            height: 54,
            borderRadius: '50%',
            border: '1px solid rgba(185,122,31,.28)',
            background: 'linear-gradient(145deg,#FFF7DE,#F2C76F)',
            color: '#7A4C12',
            boxShadow: '0 8px 24px rgba(80,45,10,.18)',
            fontSize: 24,
            cursor: 'pointer',
          }}
        >
          🐾
        </button>
      )}
      {showVault && <VaultPage onClose={() => setShowVault(false)} />}
    </>
  );
}
