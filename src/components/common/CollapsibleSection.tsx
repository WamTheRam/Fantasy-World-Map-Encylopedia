import type { ReactNode } from 'react';
import { UiIcon } from './UiIcon';
import styles from './CollapsibleSection.module.css';

interface CollapsibleSectionProps {
  title: string;
  /** Shown next to the title, e.g. how many items are inside. */
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A titled section that expands and collapses. Built on <details>, so it is keyboard accessible for free. */
export function CollapsibleSection({ title, count, defaultOpen = true, children }: CollapsibleSectionProps) {
  return (
    <details className={styles.section} open={defaultOpen}>
      <summary className={styles.summary}>
        <span className={styles.title}>{title}</span>
        {count !== undefined && <span className={styles.count}>{count}</span>}
        <span className={styles.chevron}>
          <UiIcon name="chevronDown" size={18} />
        </span>
      </summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
