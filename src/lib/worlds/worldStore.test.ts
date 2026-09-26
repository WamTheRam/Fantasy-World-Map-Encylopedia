import { beforeEach, describe, expect, it } from 'vitest';
import { worldLoads } from '@/lib/content/loadWorld';
import {
  DEFAULT_BACKGROUND,
  createWorld,
  deleteWorld,
  getActiveWorldId,
  getLocalWorldBundle,
  getWorldSummary,
  isFileBackedWorldId,
  listWorlds,
  resolveWorldLoad,
  setActiveWorldId,
  updateWorldBackground,
} from './worldStore';

const fileBackedId = Object.keys(worldLoads)[0];

describe('worldStore', () => {
  beforeEach(() => {
    // The test environment has no `localStorage`, so the module falls back to an in-memory
    // map that persists across tests in this file. Reset the worlds it manages between tests.
    // (createWorld only reaches the dev-server scaffold call when `window` exists, which it
    // doesn't here, so every world created in these tests is browser-only.)
    for (const world of listWorlds()) {
      if (world.kind === 'local') deleteWorld(world.id);
    }
    setActiveWorldId(null);
  });

  it('always includes every file-backed world', () => {
    const worlds = listWorlds();
    expect(worlds).toHaveLength(1);
    expect(worlds[0]).toMatchObject({ id: fileBackedId, kind: 'file', backgroundColor: DEFAULT_BACKGROUND });
    expect(isFileBackedWorldId(fileBackedId)).toBe(true);
    expect(isFileBackedWorldId('not-a-real-id')).toBe(false);
  });

  it('creates a new, empty local world with a unique, slugified id', async () => {
    const a = await createWorld('Homebrew Isles');
    expect(a.id).toBe('homebrew-isles');
    expect(a.kind).toBe('local');
    expect(a.backgroundColor).toBe(DEFAULT_BACKGROUND);

    const bundle = getLocalWorldBundle(a.id);
    expect(bundle).toEqual({ config: { id: a.id, name: 'Homebrew Isles', map: { width: 4000, height: 3000 } }, files: [], markdown: [] });

    // A second world with the same name gets a distinct id.
    const b = await createWorld('Homebrew Isles');
    expect(b.id).toBe('homebrew-isles-2');
    expect(listWorlds().map((w) => w.id)).toEqual(expect.arrayContaining([fileBackedId, a.id, b.id]));
  });

  it('keeps each world independent: creating or deleting one never touches another', async () => {
    const a = await createWorld('Alpha');
    const b = await createWorld('Beta');

    updateWorldBackground(a.id, '#111111');
    updateWorldBackground(b.id, '#222222');
    expect(getWorldSummary(a.id)?.backgroundColor).toBe('#111111');
    expect(getWorldSummary(b.id)?.backgroundColor).toBe('#222222');
    expect(getWorldSummary(fileBackedId)?.backgroundColor).toBe(DEFAULT_BACKGROUND);

    deleteWorld(a.id);
    expect(getWorldSummary(a.id)).toBeUndefined();
    expect(getLocalWorldBundle(a.id)).toBeUndefined();
    // World b and the file-backed world survive untouched.
    expect(getWorldSummary(b.id)?.backgroundColor).toBe('#222222');
    expect(getWorldSummary(fileBackedId)).toBeDefined();
  });

  it('clears the active world when the active world is deleted, but not otherwise', async () => {
    const a = await createWorld('Gamma');
    const b = await createWorld('Delta');
    setActiveWorldId(a.id);

    deleteWorld(b.id);
    expect(getActiveWorldId()).toBe(a.id);

    deleteWorld(a.id);
    expect(getActiveWorldId()).toBeNull();
  });

  it('resolves a file-backed world by reusing its precomputed load, and local worlds via buildWorld', async () => {
    expect(resolveWorldLoad(fileBackedId)).toBe(worldLoads[fileBackedId]);

    const local = await createWorld('Empty Land');
    const result = resolveWorldLoad(local.id);
    expect(result.issues).toEqual([]);
    expect(result.index?.world.id).toBe(local.id);
    expect(result.index?.locations).toEqual([]);

    expect(resolveWorldLoad('does-not-exist').index).toBeNull();
  });

  // Intentionally the last test in this file: it hides the file-backed world from the shared
  // in-memory store this module falls back to (see beforeEach), which would otherwise affect
  // every test above if it ran earlier.
  it('deleting a file-backed world hides it instead of touching its files, and it does not come back on its own', () => {
    expect(listWorlds().some((w) => w.id === fileBackedId)).toBe(true);
    deleteWorld(fileBackedId);
    expect(listWorlds().some((w) => w.id === fileBackedId)).toBe(false);
    // Its content is still there for whoever resolves it directly -- only the Home listing hid it.
    expect(resolveWorldLoad(fileBackedId)).toBe(worldLoads[fileBackedId]);
  });
});
