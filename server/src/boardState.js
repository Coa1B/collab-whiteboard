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

  snapshot(boardId) {
    const { strokes, notes } = this.get(boardId);
    return { strokes: [...strokes], notes: { ...notes } };
  }
}

module.exports = { BoardStore };
