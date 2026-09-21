import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Editor.module.css';

const KEY = 'atlas.flash';
/**
 * How long a note stays relevant. Reloading in dev can be slow (Vite refetches many modules after a data
 * change), and a save can reload twice, so the note is time-limited rather than "read once".
 */
const LIFETIME_MS = 30_000;
/** Once shown, a note is only shown again by a reload this soon after (the second half of a double reload). */
const RESHOW_WINDOW_MS = 4000;
/** How long the note stays on screen once shown. */
const DISPLAY_MS = 4500;

interface Flash {
  message: string;
  /** Where to go once the page is back: a newly created entry's address. */
  goto?: string;
  /** The address the save happened at. The redirect only applies to loads that land back here. */
  from?: string;
  at: number;
  /** When the note was first put on screen. */
  shownAt?: number;
}

/**
 * Leaves a note for the next page load. Call it BEFORE sending the save: the dev
 * server writes the files, and a reload can begin before the HTTP response
 * arrives. Clear it if the save fails.
 */
export function leaveFlash(message: string, goto?: string) {
  const flash: Flash = { message, goto, from: window.location.pathname, at: Date.now() };
  sessionStorage.setItem(KEY, JSON.stringify(flash));
}

/** Removes the note, e.g. because the save it announced failed. */
export function clearFlash() {
  sessionStorage.removeItem(KEY);
}

function readFlash(): Flash | null {
  try {
    const flash = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Flash | null;
    const fresh = flash && Date.now() - flash.at < LIFETIME_MS;
    const alreadyShown = flash?.shownAt !== undefined && Date.now() - flash.shownAt > RESHOW_WINDOW_MS;
    if (flash && fresh && !alreadyShown) return flash;
  } catch {
    /* malformed: fall through and discard */
  }
  clearFlash(); // expired or unreadable
  return null;
}

/**
 * Shows the editor's "Saved" note after the page comes back from a save, and (after
 * creating an entry) opens it. The page may reload once or twice on the way, so the
 * note and destination live in storage until they expire. Development only.
 */
export default function FlashToast() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [flash] = useState(readFlash);
  const [visible, setVisible] = useState(flash !== null);

  // Only a load that lands where the save happened is part of that save. Someone who has since
  // gone elsewhere is never redirected. (A save can reload twice, so this can run more than once.)
  useEffect(() => {
    if (flash?.goto && flash.from === window.location.pathname && flash.goto !== pathname) navigate(flash.goto, { replace: true });
  }, [flash, pathname, navigate]);

  useEffect(() => {
    if (!flash) return;
    if (flash.shownAt === undefined) sessionStorage.setItem(KEY, JSON.stringify({ ...flash, shownAt: Date.now() }));
    const timer = setTimeout(() => setVisible(false), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  return visible && flash ? (
    <div role="status" className={styles.toast}>
      {flash.message}
    </div>
  ) : null;
}
