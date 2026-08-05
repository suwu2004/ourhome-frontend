import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, BACKEND } from './api.js';

export default function ReadingShelfLiveNote() {
  const [target, setTarget] = useState(null);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let stopped = false;
    let observer = null;

    const syncTarget = () => {
      const next = document.querySelector('.reading-room--shelf .reading-shelf-intro');
      setTarget(current => (current === next ? current : next));
    };

    const load = async () => {
      try {
        const booksResponse = await apiFetch(`${BACKEND}/reading/books`);
        const books = await booksResponse.json().catch(() => []);
        if (!booksResponse.ok || !Array.isArray(books) || !books[0]?.id) return;
        const notesResponse = await apiFetch(`${BACKEND}/reading/books/${books[0].id}/notes?author=luze&limit=1`);
        const notes = await notesResponse.json().catch(() => []);
        if (!stopped && notesResponse.ok && Array.isArray(notes)) setNote(notes[0] || null);
      } catch {
        if (!stopped) setNote(null);
      }
    };

    syncTarget();
    load();
    observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!target) return undefined;
    target.classList.toggle('has-live-luze-note', Boolean(note));
    return () => target.classList.remove('has-live-luze-note');
  }, [note, target]);

  if (!target || !document.body.contains(target) || !note) return null;
  return createPortal(
    <p className="reading-shelf-thought reading-shelf-thought--live">
      {note.quote && <q>{note.quote}</q>}
      {note.content && <span>“{note.content}”</span>}
      <em>—— 陆泽{note.pinned ? ' · 置顶书签' : ''}</em>
    </p>,
    target,
  );
}
