# Collaborative Whiteboard

A real-time shared canvas where multiple users draw and collaborate at the same time and see each other's changes instantly.

**Stack:** React + Konva.js · Socket.io · Node.js/Express · PostgreSQL (planned) · Jest + React Testing Library

## Getting started

```bash
npm install
npm run dev   # server on :4000 and client on :5173 together
npm test
```

Open the client in two browser windows to see strokes sync.

## Project layout

```
server/   Express + Socket.io server, in-memory board store
client/   Vite + React + react-konva frontend
```

## Roadmap (v1)

- [x] Project scaffold, socket connection, join snapshot
- [x] Freehand pen + eraser + color picker
- [x] Live stroke streaming (points batched every 40ms)
- [x] Sticky notes (add, edit, move)
- [x] Live cursors (throttled to 50ms)
- [x] Conflict resolution for concurrent edits/moves (locks + versioning)
- [ ] PostgreSQL persistence for board state
- [ ] Stretch: Redis adapter for multi-instance scaling

## Conflict resolution

Sticky notes use two layers of protection against concurrent edits:

1. **Locks for in-progress interactions.** Dragging or editing a note first acquires a lock on the server. Other users see the note outlined with the editor's name and cannot grab it until the lock is released (on drop, save, cancel, or disconnect).
2. **Optimistic concurrency for commits.** Each commit includes the version it was based on. If the note changed since then (for example, the client had not yet received another user's commit), the server rejects the commit and the client rolls back to the authoritative state instead of silently overwriting someone else's work.

Drag positions are streamed to other users while dragging but are only stored once the move is committed.

**Out of scope:** layers/vector shapes, undo/redo, auth/permissions, mobile, Figma-level features.
