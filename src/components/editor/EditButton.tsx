import { Suspense, lazy, useState } from 'react';
import { UiIcon } from '@/components/common/UiIcon';
import { useWorld } from '@/context/WorldContext';
import { isFileBackedWorldId } from '@/lib/worlds/worldStore';
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
  const { world } = useWorld();
  const [open, setOpen] = useState(false);
  // The dev save server writes into a world's own folder under src/data/worlds/<id>, which
  // only exists for a file-backed world (this app's bundled one, or one scaffolded by Home's
  // "Create World" while a dev server is running). A browser-only world has no such folder,
  // so hide Edit there rather than trying to save somewhere that doesn't exist.
  // See MapCanvas.tsx for the equivalent guard on the Trace tool.
  if (!EntityEditor || !isFileBackedWorldId(world.id)) return null;
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
  const { world } = useWorld();
  const [open, setOpen] = useState(false);
  if (!EntityEditor || !isFileBackedWorldId(world.id)) return null;
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
