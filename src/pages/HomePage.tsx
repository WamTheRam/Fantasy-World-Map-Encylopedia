import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UiIcon } from '@/components/common/UiIcon';
import { createWorld, deleteWorld, listWorlds, setActiveWorldId, type WorldSummary } from '@/lib/worlds/worldStore';
import styles from './HomePage.module.css';

/** Typed exactly (case-sensitive) before a world can be deleted. */
const CONFIRM_PHRASE = 'delete world';

/**
 * Shown before entering any world: every world on this device, with ways to open, create and
 * delete them. Opening a world only changes which one is *active* (`worldStore`) — it never
 * touches another world's data, so worlds stay independent of one another.
 */
export function HomePage() {
  const navigate = useNavigate();
  const [worlds, setWorlds] = useState<WorldSummary[]>(() => listWorlds());
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorldSummary | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'Your worlds';
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pendingDelete) {
      setConfirmText('');
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [pendingDelete]);

  const refresh = useCallback(() => setWorlds(listWorlds()), []);

  const openWorld = (id: string) => {
    setActiveWorldId(id);
    navigate('/atlas');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      nameInputRef.current?.focus();
      return;
    }
    setCreating(true);
    try {
      await createWorld(trimmed);
      setNewName('');
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const closeDeleteDialog = () => setPendingDelete(null);

  const confirmDelete = () => {
    if (!pendingDelete || confirmText !== CONFIRM_PHRASE) return;
    deleteWorld(pendingDelete.id);
    setPendingDelete(null);
    refresh();
  };

  return (
    <main className={styles.home}>
      <header className={styles.header}>
        <h1 className={styles.title}>Your worlds</h1>
        <p className={styles.subtitle}>Open a world to explore its atlas and encyclopedia, or start a new one.</p>
      </header>

      <form className={styles.createForm} onSubmit={handleCreate}>
        <label className={styles.createLabel} htmlFor="new-world-name">
          New world
        </label>
        <div className={styles.createRow}>
          <input
            id="new-world-name"
            ref={nameInputRef}
            className={styles.createInput}
            type="text"
            placeholder="World name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
          />
          <button type="submit" className={styles.createButton} disabled={creating}>
            <UiIcon name="plus" size={18} />
            {creating ? 'Creating…' : 'Create World'}
          </button>
        </div>
      </form>

      {worlds.length === 0 ? (
        <p className={styles.empty}>No worlds yet. Create one above to get started.</p>
      ) : (
        <ul className={styles.grid}>
          {worlds.map((w) => (
            <li key={w.id} className={styles.card}>
              <div className={styles.swatch} style={{ background: w.backgroundColor }} aria-hidden="true" />
              <div className={styles.cardBody}>
                <p className={styles.cardName}>{w.name}</p>
                <p className={styles.cardMeta}>
                  {w.kind === 'file' ? 'Saved to this project' : `Created ${new Date(w.createdAt).toLocaleDateString()} · this browser only`}
                </p>
              </div>
              <div className={styles.cardActions}>
                <button type="button" className={styles.openButton} onClick={() => openWorld(w.id)}>
                  Open
                </button>
                <button type="button" className={styles.deleteButton} onClick={() => setPendingDelete(w)} aria-label={`Delete ${w.name}`}>
                  <UiIcon name="trash" size={17} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        onClose={closeDeleteDialog}
        onCancel={closeDeleteDialog}
        onClick={(e) => {
          if (e.target === dialogRef.current) closeDeleteDialog(); // a click on the backdrop
        }}
      >
        {pendingDelete && (
          <div className={styles.dialogBody}>
            <h2 className={styles.dialogHeading}>Delete &ldquo;{pendingDelete.name}&rdquo;?</h2>
            <p className={styles.dialogText}>
              {pendingDelete.kind === 'file'
                ? "This removes it from your list on this device. Its files aren't touched — delete its folder yourself (src/data/worlds, src/content/worlds) if you want it gone for good."
                : "This permanently removes this world's map, entities and history from this device. It cannot be undone."}
            </p>
            <p className={styles.dialogText}>
              Type <code className={styles.phrase}>{CONFIRM_PHRASE}</code> below to confirm.
            </p>
            <input
              className={styles.confirmInput}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label={`Type "${CONFIRM_PHRASE}" to confirm`}
            />
            <div className={styles.dialogActions}>
              <button type="button" className={styles.cancelButton} onClick={closeDeleteDialog}>
                Cancel
              </button>
              <button type="button" className={styles.confirmDeleteButton} disabled={confirmText !== CONFIRM_PHRASE} onClick={confirmDelete}>
                Delete world
              </button>
            </div>
          </div>
        )}
      </dialog>
    </main>
  );
}
