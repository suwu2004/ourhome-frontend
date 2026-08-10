import { useEffect, useState } from 'react';

export function SettingsGroup({ theme, icon = '✦', title, subtitle, children, defaultOpen = false, resetKey, openSignal, mountOnOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [childrenMounted, setChildrenMounted] = useState(() => !mountOnOpen || defaultOpen);

  useEffect(() => {
    if (resetKey !== undefined) setOpen(false);
  }, [resetKey]);

  useEffect(() => {
    if (openSignal?.key === undefined) return;
    const nextOpen = Boolean(openSignal.open);
    setOpen(nextOpen);
    if (nextOpen && mountOnOpen) setChildrenMounted(true);
  }, [mountOnOpen, openSignal?.key]);

  const toggleOpen = () => {
    setOpen(value => {
      const nextOpen = !value;
      if (nextOpen && mountOnOpen) setChildrenMounted(true);
      return nextOpen;
    });
  };

  return (
    <section style={{ marginBottom: 12, overflow: 'hidden', background: theme.white, border: `1px solid ${theme.border}`, borderRadius: 16, boxShadow: `0 8px 22px ${theme.borderLight}88` }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={toggleOpen}
        style={{ width: '100%', minHeight: 66, padding: '13px 14px', display: 'flex', alignItems: 'center', gap: 11, color: theme.text, background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span aria-hidden="true" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', flexShrink: 0, color: theme.honeyDeep, background: theme.honeyLight, border: `1px solid ${theme.honeyMid}`, borderRadius: 11, fontFamily: 'Georgia, serif', fontSize: icon.length > 1 ? 9 : 13, fontWeight: 700 }}>{icon}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ display: 'block', fontSize: 13.5, fontWeight: 650, letterSpacing: '.04em' }}>{title}</strong>
          <small style={{ display: 'block', marginTop: 3, overflow: 'hidden', color: theme.muted, fontSize: 9.5, lineHeight: 1.4, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</small>
        </span>
        <span aria-hidden="true" style={{ color: theme.honeyDeep, fontSize: 16, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}>⌄</span>
      </button>
      <div hidden={!open} style={{ padding: '14px 14px 15px', borderTop: `1px solid ${theme.borderLight}` }}>{childrenMounted ? children : null}</div>
    </section>
  );
}
