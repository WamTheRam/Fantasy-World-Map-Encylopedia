/**
 * The Edit dialog: change an entry's information and save it to its files.
 * Development only (see EditButton). Everything the dialog can change is listed
 * in `editableFields` (lib/content/savePlan.ts), and the server enforces it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { UiIcon } from '@/components/common/UiIcon';
import { cx } from '@/components/common/cx';
import { RichText } from '@/components/content/RichText';
import { useWorld } from '@/context/WorldContext';
import { categoryOfType } from '@/lib/content/categories';
import { entityKindLabel } from '@/lib/content/labels';
import { ID_PATTERN } from '@/lib/content/validateWorld';
import { ICON_LABELS } from '@/lib/map/iconLabels';
import { slugify } from '@/lib/map/trace';
import { LOCATION_ICONS, isArea, isEvent, isLocationEntity, isPoint, type Entity, type EntityType, type LocationIconName, type LoreType, type Relation } from '@/types/world';
import { clearFlash, leaveFlash } from './FlashToast';
import styles from './Editor.module.css';

type EditorProps = { onClose: () => void } & ({ mode: 'update'; entityId: string } | { mode: 'create'; kind: LoreType | 'event' });

const groupOf = (entity: Entity) => (isLocationEntity(entity) ? 'Places' : isEvent(entity) ? 'History' : categoryOfType(entity.type).label);

/** Where a new entry lives, so we can open it after saving. */
const routeFor = (kind: EntityType, id: string) => (kind === 'event' ? `/history/${id}` : `/${categoryOfType(kind as LoreType).id}/${id}`);

export default function EntityEditor(props: EditorProps) {
  const index = useWorld();
  const existing = props.mode === 'update' ? index.requireEntity(props.entityId) : null;
  const kind: EntityType = existing ? existing.type : (props as { kind: LoreType | 'event' }).kind;

  const [name, setName] = useState(existing?.name ?? '');
  const [idOverride, setIdOverride] = useState<string | null>(null);
  const [summary, setSummary] = useState(existing?.summary ?? '');
  const [body, setBody] = useState(existing ? (index.markdownOf(existing.id) ?? '') : '');
  const [relations, setRelations] = useState<Relation[]>(existing?.relations ?? []);
  const [year, setYear] = useState(existing && isEvent(existing) ? String(existing.year) : '');
  const [order, setOrder] = useState(existing && isEvent(existing) && existing.order !== undefined ? String(existing.order) : '');
  const [icon, setIcon] = useState<LocationIconName | ''>(existing && isLocationEntity(existing) && isPoint(existing) ? (existing.icon ?? '') : '');
  const [color, setColor] = useState(existing && isLocationEntity(existing) && isArea(existing) ? (existing.color ?? '') : '');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const id = existing ? existing.id : (idOverride ?? slugify(name));
  const idTaken = props.mode === 'create' && id !== '' && index.entity(id) !== undefined;
  const yearOk = year.trim() !== '' && Number.isInteger(Number(year));
  const orderOk = order.trim() === '' || Number.isFinite(Number(order));
  const ready =
    name.trim() !== '' &&
    (props.mode === 'update' || (ID_PATTERN.test(id) && !idTaken)) &&
    (kind !== 'event' || (yearOk && orderOk));

  /** Every other entity, grouped for the pickers. */
  const groups = useMemo(() => {
    const byGroup = new Map<string, Entity[]>();
    for (const entity of index.allEntities()) {
      if (entity.id === existing?.id) continue;
      byGroup.set(groupOf(entity), [...(byGroup.get(groupOf(entity)) ?? []), entity]);
    }
    return [...byGroup].map(([label, list]) => ({ label, list: list.sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [index, existing?.id]);

  const options = (
    <>
      {groups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.list.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );

  const insertLink = (targetId: string) => {
    const box = bodyRef.current;
    if (!box || !targetId) return;
    const { selectionStart: from, selectionEnd: to } = box;
    setBody((text) => `${text.slice(0, from)}[[${targetId}]]${text.slice(to)}`);
    requestAnimationFrame(() => {
      box.focus();
      box.selectionStart = box.selectionEnd = from + targetId.length + 4;
    });
  };

  const updateRelation = (i: number, patch: Partial<Relation>) => setRelations((rows) => rows.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const fields: Record<string, unknown> = {
        name: name.trim(),
        summary,
        relations: relations.filter((r) => r.label.trim() && r.target),
      };
      if (kind === 'event') {
        fields.year = Number(year);
        fields.order = order.trim() === '' ? null : Number(order);
      }
      if (kind === 'city' || kind === 'poi') fields.icon = icon || null;
      if (kind === 'country' || kind === 'region' || kind === 'island') fields.color = color.trim() || null;

      leaveFlash(`Saved “${name.trim()}”`, props.mode === 'create' ? routeFor(kind, id) : undefined);
      const response = await fetch(`${import.meta.env.BASE_URL}__atlas/entity`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: props.mode, id, kind, fields, body }),
      });
      const result = (await response.json()) as { files?: string[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Save failed.');
      setSaved(true);
      // Vite may refresh the page by itself, or not. Don't depend on it: give the file watcher a moment to notice,
      // then reload. (A new entry is opened by FlashToast once the page is back, however many reloads happen.)
      setTimeout(() => window.location.reload(), 700);
    } catch (e) {
      clearFlash();
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSaving(false);
    }
  };

  const heading = existing ? entityKindLabel(existing) : `New ${kind === 'event' ? 'event' : categoryOfType(kind as LoreType).singular.toLowerCase()}`;
  const previewMarkdown = [summary, body].filter((part) => part.trim()).join('\n\n');

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={props.onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close(); // a click on the backdrop
      }}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{existing ? `Editing · ${heading}` : heading}</p>
          <h2 className={styles.heading}>{name.trim() || 'Untitled'}</h2>
        </div>
        <button type="button" className={styles.close} onClick={() => dialogRef.current?.close()} aria-label="Close">
          <UiIcon name="close" />
        </button>
      </header>

      <div className={styles.scroll}>
        <label className={styles.field}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        {props.mode === 'create' && (
          <label className={styles.field}>
            File name (id)
            <input value={id} onChange={(e) => setIdOverride(e.target.value)} spellCheck={false} />
            <span className={cx(styles.hint, (idTaken || (id !== '' && !ID_PATTERN.test(id))) && styles.hintWarn)}>
              {idTaken
                ? 'That id is already used by another entry. Ids must be unique across the whole world.'
                : id !== '' && !ID_PATTERN.test(id)
                  ? 'Lowercase letters, digits and hyphens only.'
                  : 'Used in web addresses and to link to this entry. It cannot be changed later.'}
            </span>
          </label>
        )}

        {kind === 'event' && (
          <div className={styles.row}>
            <label className={styles.field}>
              Year
              <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="e.g. 412" aria-invalid={year !== '' && !yearOk} />
              <span className={styles.hint}>Whole number. Several events may share a year.</span>
            </label>
            <label className={styles.field}>
              Order in year
              <input value={order} onChange={(e) => setOrder(e.target.value)} inputMode="numeric" placeholder="optional" aria-invalid={!orderOk} />
              <span className={styles.hint}>Lower comes first.</span>
            </label>
          </div>
        )}

        {(kind === 'city' || kind === 'poi') && (
          <label className={styles.field}>
            Map icon
            <select value={icon} onChange={(e) => setIcon(e.target.value as LocationIconName | '')}>
              <option value="">Default</option>
              {LOCATION_ICONS.map((name) => (
                <option key={name} value={name}>
                  {ICON_LABELS[name]}
                </option>
              ))}
            </select>
          </label>
        )}

        {(kind === 'country' || kind === 'region' || kind === 'island') && (
          <label className={styles.field}>
            Map colour
            <span className={styles.colorRow}>
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#a9b78a'} onChange={(e) => setColor(e.target.value)} aria-label="Pick a colour" />
              <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Automatic" spellCheck={false} />
            </span>
            <span className={styles.hint}>Leave blank for an automatic earthy colour.</span>
          </label>
        )}

        {existing && isLocationEntity(existing) && (
          <p className={styles.note}>To change this place's shape or position on the map, use <strong>Trace → Redraw</strong>.</p>
        )}

        <label className={styles.field}>
          Summary
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          <span className={styles.hint}>A short overview, shown in lists and at the top of the page. Markdown allowed.</span>
        </label>

        <div className={styles.field}>
          <div className={styles.bodyHeader}>
            <span>Content</span>
            <div className={styles.tabs} role="tablist">
              {(['write', 'preview'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className={cx(tab === t && styles.tabOn)} onClick={() => setTab(t)}>
                  {t === 'write' ? 'Write' : 'Preview'}
                </button>
              ))}
            </div>
          </div>
          {tab === 'write' ? (
            <>
              <textarea ref={bodyRef} className={styles.bodyText} value={body} onChange={(e) => setBody(e.target.value)} rows={13} placeholder={'## Overview\nWrite in Markdown…'} />
              <div className={styles.bodyTools}>
                <select value="" onChange={(e) => insertLink(e.target.value)} aria-label="Insert a link to another entry">
                  <option value="">Insert link to…</option>
                  {options}
                </select>
                <span className={styles.hint}>
                  Write <code>[[id]]</code>, or just an entry's name or id, to link to it.
                </span>
              </div>
            </>
          ) : (
            <div className={styles.preview}>
              {previewMarkdown ? <RichText markdown={previewMarkdown} selfId={id} /> : <p className={styles.hint}>Nothing to preview yet.</p>}
            </div>
          )}
        </div>

        <fieldset className={styles.relations}>
          <legend>Connections</legend>
          {relations.length === 0 && <p className={styles.hint}>Labelled links to other entries, such as “Ruler of → Kingdom of Valen”.</p>}
          {relations.map((row, i) => (
            <div key={i} className={styles.relationRow}>
              <input value={row.label} onChange={(e) => updateRelation(i, { label: e.target.value })} placeholder="Label, e.g. Worships" aria-label="Connection label" />
              <select value={row.target} onChange={(e) => updateRelation(i, { target: e.target.value })} aria-label="Connected entry">
                <option value="">Choose…</option>
                {row.target && !index.entity(row.target) && <option value={row.target}>{row.target} (missing)</option>}
                {options}
              </select>
              <button type="button" onClick={() => setRelations((rows) => rows.filter((_, j) => j !== i))} aria-label="Remove connection">
                <UiIcon name="close" size={16} />
              </button>
            </div>
          ))}
          <button type="button" className={styles.addRow} onClick={() => setRelations((rows) => [...rows, { label: '', target: '' }])}>
            + Add connection
          </button>
        </fieldset>
      </div>

      <footer className={styles.footer}>
        <p className={cx(styles.status, error && styles.statusError)} role="status">
          {error ?? (saved ? 'Saved. Reloading…' : '')}
        </p>
        <button type="button" onClick={() => dialogRef.current?.close()} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={styles.primary} onClick={save} disabled={!ready || saving}>
          {saving ? 'Saving…' : props.mode === 'create' ? 'Create' : 'Save'}
        </button>
      </footer>
    </dialog>
  );
}
