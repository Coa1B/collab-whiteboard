// Conflict rules for sticky notes, shared by every store implementation.
//
// Two layers:
//  1. Locks: a user must hold a note's lock to drag or edit it, so two
//     people can't manipulate the same note at once. Locks expire so a
//     crashed server or client can't leave a note stuck forever; clients
//     refresh their lock while editing.
//  2. Versions: every commit names the version it was based on. If the
//     note changed since (e.g. the client hadn't yet received another
//     user's commit), the commit is rejected and the client reverts.
//
// The Redis store applies the same rules inside Lua scripts (see
// redisStore.js); the shared contract tests keep the two in step.

const LOCK_TTL_MS = 60_000;

const isHeldBy = (note, ownerId) => Boolean(note.lockedBy && note.lockedBy.id === ownerId);

function lockRule(note, owner, now, ttlMs) {
  if (!note) return { ok: false, reason: 'not_found' };
  const lock = note.lockedBy;
  if (lock && lock.id !== owner.id && lock.expiresAt > now) {
    return { ok: false, reason: 'locked', note };
  }
  return { ok: true, note: { ...note, lockedBy: { ...owner, expiresAt: now + ttlMs } } };
}

function commitRule(note, ownerId, baseVersion, changes) {
  if (!note) return { ok: false, reason: 'not_found' };
  if (!isHeldBy(note, ownerId)) return { ok: false, reason: 'locked', note };
  if (baseVersion !== note.version) {
    // Stale edit: drop it and release the lock so the note isn't stuck.
    return { ok: false, reason: 'stale', note: { ...note, lockedBy: null } };
  }
  return { ok: true, note: { ...note, ...changes, version: note.version + 1, lockedBy: null } };
}

// Only position and text are client-editable; ignore anything else.
function pickNoteChanges(changes = {}) {
  const out = {};
  if (Number.isFinite(changes.x)) out.x = changes.x;
  if (Number.isFinite(changes.y)) out.y = changes.y;
  if (typeof changes.text === 'string') out.text = changes.text.slice(0, 1000);
  return out;
}

function newNote({ id, x, y, text = '', color }) {
  return { id, x, y, text, color, version: 1, lockedBy: null };
}

module.exports = { LOCK_TTL_MS, isHeldBy, lockRule, commitRule, pickNoteChanges, newNote };
