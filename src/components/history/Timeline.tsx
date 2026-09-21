import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { UiIcon } from '@/components/common/UiIcon';
import { cx } from '@/components/common/cx';
import { useWorld } from '@/context/WorldContext';
import { layoutTimeline, type PositionedGroup, type YearGroup } from '@/lib/content/timeline';
import { entityPath } from '@/lib/routing/entityPaths';
import styles from './Timeline.module.css';

/** Heights that the CSS and the expand animation both rely on. Keep in step with Timeline.module.css. */
const BASE_HEIGHT = 192;
const ROW_HEIGHT = 40;
const DROPDOWN_EXTRA = 34;

interface TimelineProps {
  groups: YearGroup[];
  /** Id of the event whose article is open, if any. */
  selectedId?: string;
}

/**
 * A horizontal timeline. Each year that has events is a circular point on the
 * line, with the year and the first event's title beneath it. A year with a
 * single event links straight to it; a year with several expands in place to
 * list them. Distance between points grows with the time between them (see
 * `layoutTimeline`), and the whole strip scrolls sideways.
 */
export function Timeline({ groups, selectedId }: TimelineProps) {
  const layout = useMemo(() => layoutTimeline(groups), [groups]);
  const selectedYear = groups.find((g) => g.events.some((e) => e.id === selectedId))?.year ?? null;

  const [expandedYear, setExpandedYear] = useState<number | null>(selectedYear);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Opening an event that shares its year with others (say from a link) opens that year's list too.
  useEffect(() => {
    if (selectedYear !== null) setExpandedYear(selectedYear);
  }, [selectedYear]);

  // Bring the selected point into view, whichever way we arrived.
  useEffect(() => {
    if (selectedYear === null) return;
    const point = scrollerRef.current?.querySelector<HTMLElement>(`[data-year="${selectedYear}"]`);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    point?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [selectedYear]);

  const expanded = layout.groups.find((g) => g.year === expandedYear && g.events.length > 1);
  const minHeight = BASE_HEIGHT + (expanded ? expanded.events.length * ROW_HEIGHT + DROPDOWN_EXTRA : 0);

  return (
    <div ref={scrollerRef} className={styles.scroller} role="region" aria-label="Timeline of events" tabIndex={0}>
      <div className={styles.track} style={{ width: layout.width, minHeight }}>
        <div className={styles.line} />

        {layout.gaps.map((gap) => (
          <span key={`${gap.fromYear}-${gap.toYear}`} className={styles.gap} style={{ left: gap.x, width: gap.width }}>
            {gap.years.toLocaleString()} {gap.years === 1 ? 'year' : 'years'}
          </span>
        ))}

        {layout.groups.map((group, i) => (
          <TimelinePoint
            key={group.year}
            group={group}
            position={i}
            selectedId={selectedId}
            expanded={expandedYear === group.year}
            onToggle={() => setExpandedYear((current) => (current === group.year ? null : group.year))}
          />
        ))}
      </div>
    </div>
  );
}

interface TimelinePointProps {
  group: PositionedGroup;
  position: number;
  selectedId?: string;
  expanded: boolean;
  onToggle: () => void;
}

function TimelinePoint({ group, position, selectedId, expanded, onToggle }: TimelinePointProps) {
  const index = useWorld();
  const [first] = group.events;
  const many = group.events.length > 1;
  const selected = group.events.some((e) => e.id === selectedId);
  const listId = `year-${group.year}-events`;
  const style = { left: group.x, animationDelay: `${position * 70}ms` };

  return (
    <div className={cx(styles.point, selected && styles.pointSelected)} style={style} data-year={group.year}>
      {many ? (
        <button
          type="button"
          className={cx(styles.marker, styles.markerGroup)}
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-label={`Year ${group.year}: ${group.events.length} events`}
        >
          <span className={styles.count}>{group.events.length}</span>
        </button>
      ) : (
        <Link to={entityPath(index, first.id)} className={styles.marker} aria-label={`${first.name}, year ${group.year}`} />
      )}

      <span className={styles.year}>{group.year}</span>

      {many ? (
        <button type="button" className={styles.titleButton} onClick={onToggle} aria-expanded={expanded} aria-controls={listId}>
          <span className={styles.title}>{first.name}</span>
          <span className={styles.more}>
            +{group.events.length - 1} more
            <span className={cx(styles.chevron, expanded && styles.chevronOpen)}>
              <UiIcon name="chevronDown" size={14} />
            </span>
          </span>
        </button>
      ) : (
        <Link to={entityPath(index, first.id)} className={styles.titleButton}>
          <span className={styles.title}>{first.name}</span>
        </Link>
      )}

      {many && (
        <ul
          id={listId}
          className={cx(styles.dropdown, expanded && styles.dropdownOpen)}
          style={{ '--rows': group.events.length } as CSSProperties}
          inert={!expanded}
        >
          {group.events.map((event) => (
            <li key={event.id}>
              <Link to={entityPath(index, event.id)} className={cx(styles.dropItem, event.id === selectedId && styles.dropItemOn)}>
                {event.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
