import { useEffect, useRef, useState } from 'react';

const ROOT_MARGIN = '900px 0px';

export function ViewportChatImage({ src, rootRef, borderColor }) {
  const hostRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [src]);

  useEffect(() => {
    if (!src || ready) return undefined;
    const node = hostRef.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return undefined;
    }

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setReady(true);
      observer.disconnect();
    }, {
      root: rootRef?.current || null,
      rootMargin: ROOT_MARGIN,
      threshold: 0.01,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready, rootRef, src]);

  return (
    <div
      ref={hostRef}
      data-chat-image-deferred={ready ? 'loaded' : 'waiting'}
      style={{
        width: 'min(100%, 420px)',
        minHeight: ready ? 0 : 104,
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${borderColor}`,
        background: ready ? 'transparent' : 'rgba(244, 236, 220, .42)',
      }}
    >
      {ready && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
        />
      )}
    </div>
  );
}
