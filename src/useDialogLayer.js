import { useEffect } from 'react';

export function useDialogLayer(open, onClose, initialFocusRef) {
  useEffect(() => {
    if (!open) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    const frame = requestAnimationFrame(() => initialFocusRef?.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (typeof previousFocus?.focus === 'function') previousFocus.focus({ preventScroll: true });
    };
  }, [initialFocusRef, onClose, open]);
}
