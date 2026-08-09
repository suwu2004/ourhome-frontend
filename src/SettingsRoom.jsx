import { useRef } from 'react';
import ApiProfilesSettings from './ApiProfilesSettings.jsx';
import IntegrationSettings from './IntegrationSettings.jsx';
import { AgentMailSettings } from './AgentMailSettings.jsx';
import { SettingsGroup } from './SettingsGroup.jsx';
import { FONT_STYLES } from './fonts.js';
import { apiFetch, BACKEND } from './api.js';

function BackgroundImageOption({ label, description, image, busy, onUpload, onReset, theme, wide = false }) {
  const inputRef = useRef(null);
  return (
    <div style={{ minWidth: 0, padding: 10, gridColumn: wide ? '1 / -1' : undefined, background: theme.cream, border: `1px solid ${theme.borderLight}`, borderRadius: 13 }}>
      <button type="button" onClick={() => inputRef.current?.click()} style={{ width: '100%', height: 78, padding: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', color: theme.honeyDeep, background: image ? 'transparent' : `linear-gradient(145deg, ${theme.honeyLight}, ${theme.white})`, border: `1px dashed ${theme.honeyMid}`, borderRadius: 10, cursor: 'pointer' }}>
        {busy ? <span style={{ fontSize: 10 }}>上传中…</span> : image ? <img src={image} alt={`${label}背景预览`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 20, fontWeight: 300 }}>＋</span>}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={event => { onUpload(event.target.files?.[0]); event.target.value = ''; }} />
      <strong style={{ display: 'block', marginTop: 7, color: theme.text, fontSize: 11.5 }}>{label}</strong>
      <span style={{ display: 'block', marginTop: 2, color: theme.muted, fontSize: 9, lineHeight: 1.35 }}>{description}</span>
      {image && <button type="button" onClick={onReset} style={{ marginTop: 6, padding: 0, color: theme.honeyDeep, background: 'transparent', border: 0, cursor: 'pointer', fontSize: 9.5 }}>恢复默认</button>}
    </div>
  );
}

function SettingStatusCard({ theme, label, value, detail }) {
  return (
    <div style={{ minWidth: 0, padding: '10px 9px', borderRadius: 13, border: `1px solid ${theme.borderLight}`, background: theme.cream }}>
      <div style={{ color: theme.mutedLight, fontSize: 9, letterSpacing: '.12em' }}>{label}</div>
      <div style={{ marginTop: 5, color: theme.text, fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ marginTop: 3, color: theme.muted, fontSize: 9.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</div>
    </div>
  );
}

export function SettingsRoom(props) {
  const {
    stage, view, C, leaveRoom, settingsGroupsResetKey, settingsGroupsOpenSignal,
    setSettingsGroupsOpenSignal, darkMode, toggleDarkMode, fontStyle, changeFontStyle,
    selectedModel, modelsLoading, modelsError, notifStatus, dailyJournalEnabled,
    dailyJournalTime, weatherCityInput, setWeatherCityInput, setWeatherCitySaved,
    saveWeatherCity, weatherCitySaved, homeDayBgImage, homeNightBgImage,
    homeMemoBgImage, uploadingHomeBg, uploadHomeBackground, resetHomeBackground,
    homeBgError, setDailyJournalEnabled, setDailyJournalSaved,
    saveDailyJournalSchedule, dailyJournalSaved, enablePushNotifications,
    subscribing, myAvatarInputRef, partnerAvatarInputRef, uploadingAvatar,
    myAvatar, partnerAvatar, uploadAvatar, bgImageInputRef, bgImage, uploadingBg,
    uploadBgImage, bgColor, setBackgroundColor, resetBackground, whisperBgInputRef,
    whisperBgImage, uploadingWhisperBg, uploadWhisperBg, whisperBgColor,
    setWhisperBackgroundColor, resetWhisperBackground, myBubbleColor,
    partnerBubbleColor, setMyBubble, setPartnerBubble, resetBubbleColors,
    setAvailableModels, normalizeModelOptions, setSelectedModel, loadActiveModels,
    chooseModel, exportChatArchive, exportFullBackup, settingsExportState,
  } = props;

  return (
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", opacity: (stage === "home" && view === "settings") ? 1 : 0, pointerEvents: (stage === "home" && view === "settings") ? "auto" : "none", transition: "opacity .4s ease", background: C.cream }}>
        <header className="ourhome-safe-top" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingLeft: 16, paddingRight: 16, paddingBottom: 12, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span onClick={leaveRoom} style={{ fontSize: 18, color: C.honeyDeep, cursor: "pointer", padding: 4 }}>←</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: ".04em" }}>⚙ 设置</span>
        </header>
        <div className="ourhome-scroll" style={{ flex: 1, overflowY: "auto", paddingTop: 16, paddingLeft: 18, paddingRight: 18, paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <section style={{ marginBottom: 12, padding: 14, borderRadius: 18, background: `linear-gradient(145deg, ${C.white}, ${C.surface})`, border: `1px solid ${C.border}`, boxShadow: `0 8px 22px ${C.borderLight}88` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ color: C.text, fontSize: 16, fontWeight: 700, letterSpacing: '.05em' }}>家里的控制台</div>
                <div style={{ marginTop: 4, color: C.muted, fontSize: 10.5, lineHeight: 1.55 }}>外观、模型、通知、联网和备份都放在这里。</div>
              </div>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <button type="button" onClick={() => setSettingsGroupsOpenSignal(current => ({ key: current.key + 1, open: true }))} style={{ border: `1px solid ${C.honeyMid}`, borderRadius: 999, background: C.honeyLight, color: C.honeyDeep, padding: '6px 10px', fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' }}>展开全部</button>
                <button type="button" onClick={() => setSettingsGroupsOpenSignal(current => ({ key: current.key + 1, open: false }))} style={{ border: `1px solid ${C.border}`, borderRadius: 999, background: C.cream, color: C.muted, padding: '6px 10px', fontSize: 10.5, cursor: 'pointer', fontFamily: 'inherit' }}>收起</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <SettingStatusCard theme={C} label="外观" value={darkMode ? '夜间' : '日间'} detail={FONT_STYLES[fontStyle]?.label || '默认字体'} />
              <SettingStatusCard theme={C} label="模型" value={selectedModel || '未选择'} detail={modelsLoading ? '拉取中' : modelsError || '当前线路'} />
              <SettingStatusCard theme={C} label="通知" value={notifStatus === 'granted' ? '已开启' : notifStatus === 'denied' ? '已拒绝' : '未开启'} detail={dailyJournalEnabled ? `收尾 ${dailyJournalTime}` : '自动收尾关'} />
            </div>
          </section>

          <SettingsGroup theme={C} title="主题与外观" subtitle="昼夜、字体、天气和主页背景" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ fontSize: 13, color: C.text }}>{darkMode ? "🌙 夜间模式" : "☀️ 日间模式"}</span>
            <button type="button" role="switch" aria-checked={darkMode} aria-label="切换日间与夜间模式" onClick={toggleDarkMode} style={{ width: 44, height: 24, padding: 0, border: 0, borderRadius: 999, background: darkMode ? C.honey : C.honeyMid, position: "relative", cursor: "pointer", transition: "background .2s", display: "inline-block" }}>
              <span style={{ position: "absolute", top: 2, left: darkMode ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: C.white, transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>字体</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {Object.keys(FONT_STYLES).map(key => (
              <button type="button" aria-pressed={fontStyle === key} key={key} onClick={() => changeFontStyle(key)} style={{ fontFamily: FONT_STYLES[key].family, fontSize: 12.5, padding: "6px 12px", borderRadius: 999, cursor: "pointer", color: fontStyle === key ? C.honeyDeep : C.text, background: fontStyle === key ? C.honeyLight : C.cream, border: `1px solid ${fontStyle === key ? C.honeyDeep : C.border}` }}>{FONT_STYLES[key].label}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>主页天气城市</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input
              value={weatherCityInput}
              onChange={event => { setWeatherCityInput(event.target.value); setWeatherCitySaved(false); }}
              onKeyDown={event => { if (event.key === 'Enter') saveWeatherCity(); }}
              placeholder="例如：十堰、武汉、上海"
              maxLength={60}
              style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.text, background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 11px" }}
            />
            <button type="button" onClick={saveWeatherCity} style={{ flexShrink: 0, padding: "0 14px", border: 0, borderRadius: 12, color: C.white, background: C.honey, cursor: "pointer", fontSize: 12 }}>保存</button>
          </div>
          <div style={{ fontSize: 10.5, lineHeight: 1.55, color: weatherCitySaved ? C.honeyDeep : C.muted, marginBottom: 18 }}>
            {weatherCitySaved ? (weatherCityInput ? `已保存“${weatherCityInput}”，回到主页会自动刷新。` : '已清空主页天气城市。') : '保存在这台设备里，主页只显示城市与当前天气，不会持续读取定位。'}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 9, letterSpacing: ".05em" }}>主页与便签背景</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 9 }}>
            <BackgroundImageOption
              label="日间主页"
              description="会自动加一层浅蜂蜜薄纱"
              image={homeDayBgImage}
              busy={uploadingHomeBg === 'day'}
              onUpload={file => uploadHomeBackground(file, 'day')}
              onReset={() => resetHomeBackground('day')}
              theme={C}
            />
            <BackgroundImageOption
              label="夜间主页"
              description="会自动压暗，保证文字清楚"
              image={homeNightBgImage}
              busy={uploadingHomeBg === 'night'}
              onUpload={file => uploadHomeBackground(file, 'night')}
              onReset={() => resetHomeBackground('night')}
              theme={C}
            />
            <BackgroundImageOption
              label="云端便签纸"
              description="更换主页便签和展开纸页的背景"
              image={homeMemoBgImage}
              busy={uploadingHomeBg === 'memo'}
              onUpload={file => uploadHomeBackground(file, 'memo')}
              onReset={() => resetHomeBackground('memo')}
              theme={C}
              wide
            />
          </div>
          <div style={{ marginTop: 7, color: homeBgError ? C.blushDeep : C.muted, fontSize: 9.5, lineHeight: 1.5 }}>{homeBgError || '主页背景跟随昼夜切换，便签纸单独保存；三套都会在云端同步。'}</div>
          </SettingsGroup>

          <SettingsGroup theme={C} title="每日收尾" subtitle="定时补写幸福日记与心情日历" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>每天的幸福收尾</div>
          <div style={{ padding: 12, marginBottom: 18, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, color: C.text }}>缺项自动补写</div>
                <div style={{ marginTop: 3, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>只负责每天收尾，不管理记忆页的年表和收藏。</div>
              </div>
              <button type="button" role="switch" aria-checked={dailyJournalEnabled} onClick={() => { setDailyJournalEnabled(value => !value); setDailyJournalSaved(false); }} style={{ width: 44, height: 24, padding: 0, border: 0, borderRadius: 999, background: dailyJournalEnabled ? C.honey : C.honeyMid, position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: 2, left: dailyJournalEnabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: C.white, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
              <input type="time" value={dailyJournalTime} disabled={!dailyJournalEnabled} onChange={event => { setDailyJournalTime(event.target.value); setDailyJournalSaved(false); }} style={{ flex: 1, minWidth: 0, padding: '8px 10px', color: C.text, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12 }} />
              <button type="button" onClick={saveDailyJournalSchedule} style={{ padding: '8px 13px', color: C.white, background: C.honey, border: 0, borderRadius: 10, cursor: 'pointer', fontSize: 11.5 }}>保存</button>
            </div>
            <div style={{ marginTop: 6, color: dailyJournalSaved ? C.honeyDeep : C.muted, fontSize: 9.5 }}>{dailyJournalSaved ? '已经按中国时间保存好。' : '按中国时间执行；记忆页的今日摘要会按聊天另行整理。'}</div>
          </div>
          <div style={{ padding: 12, marginBottom: 18, background: C.white, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: C.text }}>提醒通知</div>
                <div style={{ marginTop: 3, fontSize: 10, color: C.muted, lineHeight: 1.5 }}>给日程提醒和陆泽主动敲门用；换设备后在这里重新登记。</div>
              </div>
              <button
                type="button"
                onClick={enablePushNotifications}
                disabled={subscribing}
                style={{ padding: '8px 12px', color: C.white, background: notifStatus === 'granted' ? C.honeyDeep : C.honey, border: 0, borderRadius: 10, cursor: subscribing ? 'default' : 'pointer', opacity: subscribing ? .65 : 1, fontSize: 11.5, flexShrink: 0 }}
              >
                {subscribing ? '登记中…' : notifStatus === 'granted' ? '重新登记' : '开启通知'}
              </button>
            </div>
            <div style={{ marginTop: 6, color: notifStatus === 'denied' ? C.blushDeep : C.muted, fontSize: 9.5, lineHeight: 1.5 }}>
              {notifStatus === 'granted' ? '这台设备已经允许通知。' : notifStatus === 'denied' ? '系统已经拒绝通知，需要先在浏览器或手机设置里打开 OurHome 通知。' : '点按钮后同意浏览器弹出的通知权限。'}
            </div>
          </div>
          </SettingsGroup>

          <SettingsGroup theme={C} title="聊天装扮" subtitle="头像、聊天墙面和气泡颜色" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>头像</div>
          <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
            <div style={{ textAlign: "center" }}>
              <div onClick={() => myAvatarInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", margin: "0 auto 6px", cursor: "pointer", background: `linear-gradient(150deg, #F2AFA2, ${C.blushDeep})`, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 18, fontWeight: 700 }}>
                {uploadingAvatar === 'me' ? <span style={{ fontSize: 10 }}>上传中…</span> : myAvatar ? <img src={myAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "檀"}
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>我的头像</span>
              <input ref={myAvatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadAvatar(e.target.files?.[0], 'me')} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div onClick={() => partnerAvatarInputRef.current?.click()} style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", margin: "0 auto 6px", cursor: "pointer", background: `linear-gradient(150deg, #E8B45A, ${C.honeyDeep})`, display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 18, fontWeight: 700 }}>
                {uploadingAvatar === 'partner' ? <span style={{ fontSize: 10 }}>传中…</span> : partnerAvatar ? <img src={partnerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "泽"}
              </div>
              <span style={{ fontSize: 11, color: C.muted }}>陆泽的头像</span>
              <input ref={partnerAvatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadAvatar(e.target.files?.[0], 'partner')} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>聊天背景</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div onClick={() => bgImageInputRef.current?.click()} style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `1.5px dashed ${C.honeyMid}`, background: bgImage ? "transparent" : C.cream, display: "flex", alignItems: "center", justifyContent: "center", color: C.honeyDeep, fontSize: 18, flexShrink: 0 }}>
              {uploadingBg ? <span style={{ fontSize: 9 }}>传中</span> : bgImage ? <img src={bgImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "＋"}
            </div>
            <input ref={bgImageInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadBgImage(e.target.files?.[0])} />
            <input type="color" value={bgColor || "#FDFAF5"} onChange={e => setBackgroundColor(e.target.value)} style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
            <span onClick={resetBackground} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>悄悄话墙面</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div onClick={() => whisperBgInputRef.current?.click()} style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `1.5px dashed ${C.honeyMid}`, background: whisperBgImage ? "transparent" : C.cream, display: "flex", alignItems: "center", justifyContent: "center", color: C.honeyDeep, fontSize: 18, flexShrink: 0 }}>
              {uploadingWhisperBg ? <span style={{ fontSize: 9 }}>上传中</span> : whisperBgImage ? <img src={whisperBgImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "＋"}
            </div>
            <input ref={whisperBgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadWhisperBg(e.target.files?.[0])} />
            <input type="color" value={whisperBgColor || "#3A2C1E"} onChange={e => setWhisperBackgroundColor(e.target.value)} style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
            <span onClick={resetWhisperBackground} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, letterSpacing: ".05em" }}>聊天气泡颜色</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <div style={{ textAlign: "center" }}>
              <input type="color" value={myBubbleColor || "#FDE8E0"} onChange={e => setMyBubble(e.target.value)} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>我的气泡</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <input type="color" value={partnerBubbleColor || "#FFFFFF"} onChange={e => setPartnerBubble(e.target.value)} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${C.border}`, cursor: "pointer", padding: 0, background: "none" }} />
              <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4 }}>陆泽的气泡</div>
            </div>
            <span onClick={resetBubbleColors} style={{ fontSize: 11.5, color: C.muted, cursor: "pointer", textDecoration: "underline" }}>恢复默认</span>
          </div>
          </SettingsGroup>

          {view === 'settings' && (
            <>
              <SettingsGroup theme={C} title="API 与模型" subtitle="保存、切换站点并拉取全部模型" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>
              <ApiProfilesSettings
                apiFetch={apiFetch}
                backend={BACKEND}
                theme={C}
                embedded
                onModelsChange={models => setAvailableModels(normalizeModelOptions(models, selectedModel))}
                onActiveChange={profile => {
                  const profileModel = profile?.selected_model || '';
                  if (profileModel) setSelectedModel(profileModel);
                  loadActiveModels(profileModel).then(models => {
                    if (!profileModel && models[0]) chooseModel(models[0]);
                  });
                }}
              />
              </SettingsGroup>

              <SettingsGroup theme={C} title="陆泽邮箱" subtitle="自主收发、实时收信与完整知情记录" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>
                <AgentMailSettings apiFetch={apiFetch} backend={BACKEND} theme={C} />
              </SettingsGroup>

              <SettingsGroup theme={C} title="联网与 MCP" subtitle="Linkup、Tavily 与远程只读工具" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>
                <IntegrationSettings apiFetch={apiFetch} backend={BACKEND} theme={C} embedded />
              </SettingsGroup>
            </>
          )}

          <SettingsGroup theme={C} title="数据与导出" subtitle="聊天存档、全量备份和迁移准备" resetKey={settingsGroupsResetKey} openSignal={settingsGroupsOpenSignal}>
            <div style={{ display: 'grid', gap: 10 }}>
              <button type="button" onClick={exportChatArchive} disabled={settingsExportState.busy} style={{ width: "100%", padding: "12px 0", textAlign: "center", border: `1.5px dashed ${C.honeyMid}`, color: C.honeyDeep, borderRadius: 12, fontSize: 13.5, cursor: settingsExportState.busy ? "default" : "pointer", background: "transparent", letterSpacing: ".05em", fontFamily: "inherit", opacity: settingsExportState.busy ? .62 : 1 }}>导出聊天记录 HTML</button>
              <button type="button" onClick={exportFullBackup} disabled={settingsExportState.busy} style={{ width: "100%", padding: "12px 0", textAlign: "center", border: `1px solid ${C.honeyMid}`, color: C.white, borderRadius: 12, fontSize: 13.5, cursor: settingsExportState.busy ? "default" : "pointer", background: `linear-gradient(145deg, ${C.honey}, ${C.honeyDeep})`, letterSpacing: ".05em", fontFamily: "inherit", opacity: settingsExportState.busy ? .62 : 1 }}>{settingsExportState.busy ? '整理中…' : '下载完整备份 JSON'}</button>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>HTML 适合回看聊天；JSON 会包含主要房间数据与设置摘要，不导出密钥原文。</div>
            {settingsExportState.notice && <div role="status" style={{ color: C.honeyDeep, fontSize: 11, marginTop: 8 }}>{settingsExportState.notice}</div>}
            {settingsExportState.error && <div role="alert" style={{ color: C.blushDeep, fontSize: 11, marginTop: 8 }}>{settingsExportState.error}</div>}
          </SettingsGroup>
        </div>
      </div>
  );
}

