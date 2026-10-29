// In-memory board state, keyed by board id. This is the live copy used for
// real-time sync; see db/persistence.js for durable storage.
class BoardStore {
  constructor() {
    this.boards = new Map();
  }

  get(boardId) {
    if (!this.boards.has(boardId)) {
      this.boards.set(boardId, { strokes: [], notes: {} });
    }
    return this.boards.get(boardId);
  }

  has(boardId) {
    return this.boards.has(boardId);
  }

  // Seeds a board from saved data, e.g. after a server restart.
  hydrate(boardId, { strokes = [], notes = {} }) {
    this.boards.set(boardId, { strokes: [...strokes], notes: { ...notes } });
  }

  findStroke(boardId, strokeId) {
    return this.get(boardId).strokes.find((s) => s.id === strokeId) || null;
  }

  addStroke(boardId, stroke) {
    this.get(boardId).strokes.push(stroke);
    return stroke;
  }

  // Appends points to an in-progress stroke. Returns false for unknown strokes.
  appendPoints(boardId, strokeId, points) {
    const { strokes } = this.get(boardId);
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].id === strokeId) {
        strokes[i] = { ...strokes[i], points: strokes[i].points.concat(points) };
        return true;
      }
    }
    return false;
  }

  // --- Sticky notes ---
  //
  // Conflict resolution uses two layers:
  //  1. Locks: a user must hold a note's lock to drag or edit it, so two
  //     people can't manipulate the same note at once.
  //  2. Versions: every commit names the version it was based on. If the
  //     note changed since (e.g. the client hadn't yet received another
  //     user's commit), the commit is rejected and the client reverts.
  // Notes are replaced, never mutated, so snapshots stay consistent.

  addNote(boardId, { id, x, y, text = '', color }) {
    const note = { id, x, y, text, color, version: 1, lockedBy: null };
    this.get(boardId).notes[id] = note;
    return note;
  }

  lockNote(boardId, noteId, owner) {
    const notes = this.get(boardId).notes;
    const note = notes[noteId];
    if (!note) return { ok: false, reason: 'not_found' };
    if (note.lockedBy && note.lockedBy.id !== owner.id) {
      return { ok: false, reason: 'locked', note };
    }
    notes[noteId] = { ...note, lockedBy: owner };
    return { ok: true, note: notes[noteId] };
  }

  // Drag positions are transient: only the lock holder may broadcast them,
  // and nothing is stored until the drag is committed.
  canMove(boardId, noteId, ownerId) {
    const note = this.get(boardId).notes[noteId];
    return Boolean(note && note.lockedBy && note.lockedBy.id === ownerId);
  }

  commitNote(boardId, noteId, ownerId, baseVersion, changes) {
    const notes = this.get(boardId).notes;
    const note = notes[noteId];
    if (!note) return { ok: false, reason: 'not_found' };
    if (!note.lockedBy || note.lockedBy.id !== ownerId) {
      return { ok: false, reason: 'locked', note };
    }
    if (baseVersion !== note.version) {
      // Stale edit: drop it and release the lock so the note isn't stuck.
      notes[noteId] = { ...note, lockedBy: null };
      return { ok: false, reason: 'stale', note: notes[noteId] };
    }
    notes[noteId] = { ...note, ...pickNoteChanges(changes), version: note.version + 1, lockedBy: null };
    return { ok: true, note: notes[noteId] };
  }

  unlockNote(boardId, noteId, ownerId) {
    const notes = this.get(boardId).notes;
    const note = notes[noteId];
    if (!note || !note.lockedBy || note.lockedBy.id !== ownerId) return null;
    notes[noteId] = { ...note, lockedBy: null };
    return notes[noteId];
  }

  // Frees every lock held by a user, e.g. when they disconnect mid-drag.
  releaseLocks(boardId, ownerId) {
    const notes = this.get(boardId).notes;
    const released = [];
    for (const note of Object.values(notes)) {
      if (note.lockedBy && note.lockedBy.id === ownerId) {
        notes[note.id] = { ...note, lockedBy: null };
        released.push(notes[note.id]);
      }
    }
    return released;
  }

  snapshot(boardId) {
    const { strokes, notes } = this.get(boardId);
    return { strokes: [...strokes], notes: { ...notes } };
  }
}

// Only position and text are client-editable; ignore anything else.
function pickNoteChanges(changes = {}) {
  const out = {};
  if (Number.isFinite(changes.x)) out.x = changes.x;
  if (Number.isFinite(changes.y)) out.y = changes.y;
  if (typeof changes.text === 'string') out.text = changes.text.slice(0, 1000);
  return out;
}

module.exports = { BoardStore };
