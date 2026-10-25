// In-memory board state, keyed by board id.
// TODO: persist to PostgreSQL; add sticky notes and conflict resolution.
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

  addStroke(boardId, stroke) {
    this.get(boardId).strokes.push(stroke);
    return stroke;
  }

  snapshot(boardId) {
    const { strokes, notes } = this.get(boardId);
    return { strokes: [...strokes], notes: { ...notes } };
  }
}

module.exports = { BoardStore };
