import { Suspense, lazy, useState } from 'react';
import { UiIcon } from '@/components/common/UiIcon';
import type { LoreType } from '@/types/world';
import styles from './Editor.module.css';

/**
 * The editor exists only in development: it saves by writing files through the
 * dev server. `import.meta.env.DEV` is a build-time constant, so a production
 * build drops the editor, and these buttons render nothing.
 */
const EntityEditor = import.meta.env.DEV ? lazy(() => import('./EntityEditor')) : null;

/** "Edit" for an existing entity: place, person, event, anything with an id. */
export function EditButton({ entityId }: { entityId: string }) {
  const [open, setOpen] = useState(false);
  if (!EntityEditor) return null;
  return (
    <>
      <button type="button" className={styles.editButton} onClick={() => setOpen(true)} title="Edit this entry's information">
        <UiIcon name="pencil" size={16} />
        Edit
      </button>
      {open && (
        <Suspense fallback={null}>
          <EntityEditor mode="update" entityId={entityId} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

/** "New person", "Add event", ... opens the same editor with a blank entry. */
export function NewEntityButton({ kind, label }: { kind: LoreType | 'event'; label: string }) {
  const [open, setOpen] = useState(false);
  if (!EntityEditor) return null;
  return (
    <>
      <button type="button" className={styles.newButton} onClick={() => setOpen(true)}>
        + {label}
      </button>
      {open && (
        <Suspense fallback={null}>
          <EntityEditor mode="create" kind={kind} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
