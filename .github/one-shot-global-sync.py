from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return text.replace(old, new, 1)

root_path = Path('src/Root.jsx')
root = root_path.read_text()
if "./globalSync.js" not in root:
    root = replace_once(
        root,
        "import { useTheme } from './ThemeContext.jsx';\n",
        "import { useTheme } from './ThemeContext.jsx';\nimport { emitGlobalSync } from './globalSync.js';\n",
        'Root global sync import',
    )
root = replace_once(
    root,
    "          onRefresh={() => {\n            setHomeRefreshToken(value => value + 1);\n            refreshTheme();\n          }}",
    "          onRefresh={() => {\n            setHomeRefreshToken(value => value + 1);\n            emitGlobalSync({ source: 'home', scope: 'all' });\n            refreshTheme();\n          }}",
    'Root home refresh',
)
root_path.write_text(root)

music_path = Path('src/MusicPlayerContext.jsx')
music = music_path.read_text()
if "./globalSync.js" not in music:
    music = replace_once(
        music,
        "import { apiFetch, BACKEND } from './api.js';\n",
        "import { apiFetch, BACKEND } from './api.js';\nimport { subscribeGlobalSync } from './globalSync.js';\n",
        'Music global sync import',
    )
music = replace_once(
    music,
    "  useEffect(() => {\n    loadMusic();\n    window.addEventListener('ourhome-auth-changed', loadMusic);\n    return () => window.removeEventListener('ourhome-auth-changed', loadMusic);\n  }, [loadMusic]);\n",
    "  useEffect(() => {\n    loadMusic();\n    window.addEventListener('ourhome-auth-changed', loadMusic);\n    const unsubscribeGlobalSync = subscribeGlobalSync(loadMusic, { scope: 'music' });\n    return () => {\n      window.removeEventListener('ourhome-auth-changed', loadMusic);\n      unsubscribeGlobalSync();\n    };\n  }, [loadMusic]);\n",
    'Music global sync subscription',
)
music_path.write_text(music)

home_path = Path('src/HomeHub.jsx')
home = home_path.read_text()
home = replace_once(
    home,
    "  useEffect(() => {\n    loadMemos();\n    loadMilestones();\n    loadMusicPreview();\n  }, [loadMemos, loadMilestones, loadMusicPreview, refreshToken]);\n",
    "  useEffect(() => {\n    loadMemos();\n    loadMilestones();\n  }, [loadMemos, loadMilestones, refreshToken]);\n\n  useEffect(() => {\n    loadMusicPreview();\n  }, [loadMusicPreview]);\n",
    'HomeHub avoid duplicate music refresh',
)
home_path.write_text(home)

pkg_path = Path('package.json')
pkg = pkg_path.read_text()
if 'scripts/global-sync-regression.test.mjs' not in pkg:
    anchor = 'scripts/music-playback-regression.test.mjs scripts/theater-chat-ux-regression.test.mjs'
    if anchor not in pkg:
        raise SystemExit('package test:app anchor missing')
    pkg = pkg.replace(anchor, anchor + ' scripts/global-sync-regression.test.mjs', 1)
pkg_path.write_text(pkg)
