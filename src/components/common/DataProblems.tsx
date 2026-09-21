import { useState } from 'react';
import type { ValidationIssue } from '@/lib/content/validateWorld';
import styles from './DataProblems.module.css';

/** Full-screen report shown instead of the app when the world data has errors. */
export function DataProblems({ issues }: { issues: ValidationIssue[] }) {
  const errors = issues.filter((i) => i.severity === 'error');
  return (
    <main className={styles.screen}>
      <h1>Your world data needs a fix</h1>
      <p className={styles.lead}>
        {errors.length === 1 ? 'One problem was' : `${errors.length} problems were`} found in <code>src/data</code>. Fix{' '}
        {errors.length === 1 ? 'it' : 'them'} and save: the page reloads on its own.
      </p>
      <ul className={styles.list}>
        {issues.map((issue, i) => (
          <li key={i} className={issue.severity === 'error' ? styles.error : styles.warning}>
            <code>{issue.file}</code>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

/** Small development-only note about non-fatal issues (e.g. a marker drawn outside its region). */
export function DataWarnings({ issues }: { issues: ValidationIssue[] }) {
  const warnings = issues.filter((i) => i.severity === 'warning');
  const [dismissed, setDismissed] = useState(false);
  if (warnings.length === 0 || dismissed) return null;
  return (
    <aside className={styles.banner} role="status">
      <details>
        <summary>
          {warnings.length} data {warnings.length === 1 ? 'warning' : 'warnings'}
        </summary>
        <ul>
          {warnings.map((w, i) => (
            <li key={i}>
              <code>{w.file}</code> {w.message}
            </li>
          ))}
        </ul>
      </details>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss warnings">
        Dismiss
      </button>
    </aside>
  );
}
