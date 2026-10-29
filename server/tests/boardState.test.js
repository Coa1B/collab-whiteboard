const { BoardStore } = require('../src/boardState');

describe('BoardStore', () => {
  test('new board starts empty', () => {
    const store = new BoardStore();
    expect(store.snapshot('a')).toEqual({ strokes: [], notes: {} });
  });

  test('strokes are stored per board', () => {
    const store = new BoardStore();
    store.addStroke('a', { id: '1', points: [0, 0, 10, 10] });
    expect(store.snapshot('a').strokes).toHaveLength(1);
    expect(store.snapshot('b').strokes).toHaveLength(0);
  });

  test('snapshot is a copy, not a live reference', () => {
    const store = new BoardStore();
    const snap = store.snapshot('a');
    store.addStroke('a', { id: '1', points: [] });
    expect(snap.strokes).toHaveLength(0);
  });
});

describe('appendPoints', () => {
  test('extends an existing stroke', () => {
    const store = new BoardStore();
    store.addStroke('a', { id: 's1', points: [0, 0] });
    expect(store.appendPoints('a', 's1', [5, 5, 10, 10])).toBe(true);
    expect(store.snapshot('a').strokes[0].points).toEqual([0, 0, 5, 5, 10, 10]);
  });

  test('ignores unknown strokes', () => {
    const store = new BoardStore();
    expect(store.appendPoints('a', 'missing', [1, 1])).toBe(false);
  });
});

describe('sticky note conflict resolution', () => {
  const alice = { id: 'alice', name: 'Alice', color: '#e11d48' };
  const bob = { id: 'bob', name: 'Bob', color: '#2563eb' };

  const setup = () => {
    const store = new BoardStore();
    store.addNote('a', { id: 'n1', x: 0, y: 0, text: 'hi', color: '#fff59d' });
    return store;
  };

  test('new notes start at version 1 and unlocked', () => {
    const note = setup().snapshot('a').notes.n1;
    expect(note).toMatchObject({ version: 1, lockedBy: null });
  });

  test('only one user can hold a note lock at a time', () => {
    const store = setup();
    expect(store.lockNote('a', 'n1', alice).ok).toBe(true);
    const res = store.lockNote('a', 'n1', bob);
    expect(res).toMatchObject({ ok: false, reason: 'locked' });
    expect(res.note.lockedBy.id).toBe('alice');
  });

  test('re-locking a note you already hold succeeds', () => {
    const store = setup();
    store.lockNote('a', 'n1', alice);
    expect(store.lockNote('a', 'n1', alice).ok).toBe(true);
  });

  test('only the lock holder may broadcast drag positions', () => {
    const store = setup();
    store.lockNote('a', 'n1', alice);
    expect(store.canMove('a', 'n1', 'alice')).toBe(true);
    expect(store.canMove('a', 'n1', 'bob')).toBe(false);
  });

  test('committing applies changes, bumps the version, and releases the lock', () => {
    const store = setup();
    store.lockNote('a', 'n1', alice);
    const res = store.commitNote('a', 'n1', 'alice', 1, { x: 50, y: 60 });
    expect(res.ok).toBe(true);
    expect(res.note).toMatchObject({ x: 50, y: 60, version: 2, lockedBy: null });
  });

  test('commits without the lock are rejected', () => {
    const store = setup();
    store.lockNote('a', 'n1', alice);
    const res = store.commitNote('a', 'n1', 'bob', 1, { text: 'overwrite' });
    expect(res).toMatchObject({ ok: false, reason: 'locked' });
    expect(store.snapshot('a').notes.n1.text).toBe('hi');
  });

  test('a stale commit is rejected and the lock is released', () => {
    const store = setup();
    // Alice edits and commits (v1 -> v2).
    store.lockNote('a', 'n1', alice);
    store.commitNote('a', 'n1', 'alice', 1, { text: 'alice was here' });
    // Bob's client still thinks the note is v1 when he grabs it.
    store.lockNote('a', 'n1', bob);
    const res = store.commitNote('a', 'n1', 'bob', 1, { x: 999 });
    expect(res).toMatchObject({ ok: false, reason: 'stale' });
    expect(res.note).toMatchObject({ text: 'alice was here', x: 0, version: 2, lockedBy: null });
  });

  test('only position and text can be changed', () => {
    const store = setup();
    store.lockNote('a', 'n1', alice);
    const { note } = store.commitNote('a', 'n1', 'alice', 1, { version: 100, color: 'red', x: 'NaN' });
    expect(note).toMatchObject({ version: 2, color: '#fff59d', x: 0 });
  });

  test('unlock only works for the lock holder', () => {
    const store = setup();
    store.lockNote('a', 'n1', alice);
    expect(store.unlockNote('a', 'n1', 'bob')).toBeNull();
    expect(store.unlockNote('a', 'n1', 'alice').lockedBy).toBeNull();
  });

  test('disconnecting releases all of that user\'s locks', () => {
    const store = setup();
    store.addNote('a', { id: 'n2', x: 0, y: 0, color: '#fff59d' });
    store.lockNote('a', 'n1', alice);
    store.lockNote('a', 'n2', alice);
    const released = store.releaseLocks('a', 'alice');
    expect(released.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(store.lockNote('a', 'n1', bob).ok).toBe(true);
  });
});

describe('hydrate', () => {
  test('loads saved strokes and notes into a board', () => {
    const store = new BoardStore();
    expect(store.has('a')).toBe(false);
    store.hydrate('a', {
      strokes: [{ id: 's1', points: [0, 0] }],
      notes: { n1: { id: 'n1', x: 1, y: 2, text: 'saved', version: 3, lockedBy: null } },
    });
    expect(store.has('a')).toBe(true);
    expect(store.snapshot('a').strokes).toHaveLength(1);
    expect(store.snapshot('a').notes.n1.version).toBe(3);
  });

  test('hydrated notes keep their version for conflict checks', () => {
    const store = new BoardStore();
    store.hydrate('a', { notes: { n1: { id: 'n1', x: 0, y: 0, text: '', version: 3, lockedBy: null } } });
    store.lockNote('a', 'n1', { id: 'alice' });
    expect(store.commitNote('a', 'n1', 'alice', 1, { x: 5 }).reason).toBe('stale');
  });
});
