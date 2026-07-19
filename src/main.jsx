import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import FinanceVault from './FinanceVault.jsx'

function Root() {
  const [page, setPage] = useState(() => window.location.hash === '#vault' ? 'vault' : 'home')

  const openVault = () => {
    window.location.hash = 'vault'
    setPage('vault')
  }

  const closeVault = () => {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setPage('home')
  }

  if (page === 'vault') return <FinanceVault onBack={closeVault} />

  return (
    <>
      <App />
      <button
        onClick={openVault}
        aria-label="打开猫の金库"
        title="猫の金库"
        style={{
          position: 'fixed', right: 16, bottom: 18, zIndex: 9999,
          width: 54, height: 54, borderRadius: '50%', border: '1px solid #E9CF9C',
          background: 'linear-gradient(145deg,#FFF3D6,#E8B45A)', color: '#6E4615',
          boxShadow: '0 9px 24px rgba(105,67,21,.28)', fontSize: 24,
          cursor: 'pointer', display: 'grid', placeItems: 'center'
        }}
      >
        💰
      </button>
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
