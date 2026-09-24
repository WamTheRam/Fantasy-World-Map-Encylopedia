import { useMemo } from 'react';
import { CollapsibleSection } from '@/components/common/CollapsibleSection';
import { useWorld } from '@/context/WorldContext';
import { entityKindLabel } from '@/lib/content/labels';
import type { Entity } from '@/types/world';
import { EntityLink } from './EntityLink';
import { RichText } from './RichText';
import styles from './Content.module.css';

/**
 * The summary and long-form content of an entity: a short "Overview" (the
 * summary), styled distinctly as an introduction, above the main article (the
 * Markdown body). They share one `linked` set so an entity mentioned in the
 * Overview isn't linked again on first mention in the article below it.
 */
export function EntityProse({ entity }: { entity: Entity }) {
  const index = useWorld();
  const summary = entity.summary?.trim() || null;
  const body = index.markdownOf(entity.id)?.trim() || null;
  // A fresh "first mention" set per entity, shared between the Overview and article below.
  const linked = useMemo(() => new Set<string>(), [entity.id]);

  if (!summary && !body) {
    return (
      <p className={styles.empty}>
        Nothing has been written about {entity.name} yet. Use <strong>Edit</strong> (or add a <code>"summary"</code> to its JSON file) to fill this in.
      </p>
    );
  }

  return (
    <>
      {summary && (
        <div className={styles.overview}>
          <RichText markdown={summary} selfId={entity.id} linked={linked} />
        </div>
      )}
      {body && <RichText markdown={body} selfId={entity.id} linked={linked} />}
    </>
  );
}

/** Labelled links out of this entity: "Ruler of: Kingdom of Valen". */
export function Connections({ entity }: { entity: Entity }) {
  const relations = entity.relations ?? [];
  if (relations.length === 0) return null;

  // Group targets under a shared label, keeping the order they were written in.
  const groups = new Map<string, string[]>();
  for (const { label, target } of relations) groups.set(label, [...(groups.get(label) ?? []), target]);

  return (
    <CollapsibleSection title="Connections" count={relations.length}>
      <dl className={styles.connections}>
        {[...groups].map(([label, targets]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {targets.map((target, i) => (
                <span key={target}>
                  {i > 0 && ', '}
                  <EntityLink id={target} />
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </CollapsibleSection>
  );
}

/** Everything that points here, through a relation or a mention. Makes the world read as a web, not a tree. */
export function LinkedFrom({ entity }: { entity: Entity }) {
  const index = useWorld();
  const backlinks = index.backlinksOf(entity.id);
  if (backlinks.length === 0) return null;

  return (
    <CollapsibleSection title="Linked from" count={backlinks.length} defaultOpen={backlinks.length <= 6}>
      <ul className={styles.backlinks}>
        {backlinks.map(({ id, label }) => {
          const source = index.requireEntity(id);
          return (
            <li key={id}>
              <EntityLink id={id} />
              <span className={styles.backlinkMeta}>{label ? `${entityKindLabel(source)} · ${label}` : entityKindLabel(source)}</span>
            </li>
          );
        })}
      </ul>
    </CollapsibleSection>
  );
}
