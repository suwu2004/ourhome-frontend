import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root.jsx'
import './styles.css'
import { applyAppFont, getSavedFont } from './fonts.js'
import { MusicPlayerProvider } from './MusicPlayerContext.jsx'
import { ThemeProvider } from './ThemeContext.jsx'
import { installMessageModelLabels } from './messageModelLabels.js'
import CloudSyncBadge from './CloudSyncBadge.jsx'
import { registerOfflineShell } from './offlineShell.js'
import OfflineUpdateNotice from './OfflineUpdateNotice.jsx'

applyAppFont(getSavedFont(), { persist: false })
installMessageModelLabels()
registerOfflineShell()

const updateViewportHeight = () => {
  const viewportHeight = window.visualViewport?.height || window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`)
}

let viewportFrame = 0
const scheduleViewportUpdate = () => {
  cancelAnimationFrame(viewportFrame)
  viewportFrame = requestAnimationFrame(updateViewportHeight)
}

updateViewportHeight()
window.addEventListener('resize', scheduleViewportUpdate, { passive: true })
window.addEventListener('orientationchange', scheduleViewportUpdate, { passive: true })
window.visualViewport?.addEventListener('resize', scheduleViewportUpdate, { passive: true })
window.visualViewport?.addEventListener('scroll', scheduleViewportUpdate, { passive: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <MusicPlayerProvider>
      <Root />
      <CloudSyncBadge />
      <OfflineUpdateNotice />
    </MusicPlayerProvider>
  </ThemeProvider>,
)
