import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UiIcon } from '@/components/common/UiIcon';
import { useWorld } from '@/context/WorldContext';
import { useWorldSettings } from '@/context/WorldSettingsContext';
import styles from './WorldSettings.module.css';

/**
 * The current world's settings, opened from the hamburger menu. Kept deliberately small for now
 * (just the background colour); anything it changes is stored as part of the world's own data
 * (`worldStore`), never hardcoded into the UI, so it persists across reloads.
 */
export function WorldSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { world } = useWorld();
  const { backgroundColor, setBackgroundColor } = useWorldSettings();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose(); // a click on the backdrop
      }}
    >
      <div className={styles.body}>
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>World Settings</p>
            <h2 className={styles.heading}>{world.name}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <UiIcon name="close" />
          </button>
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Background colour</span>
          <span className={styles.colorRow}>
            <input
              type="color"
              className={styles.colorInput}
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              aria-label="Background colour"
            />
            <span className={styles.colorValue}>{backgroundColor}</span>
          </span>
          <span className={styles.fieldHint}>Sets the map and world background. Saved automatically, for this world only.</span>
        </label>
      </div>
    </dialog>,
    document.body,
  );
}
