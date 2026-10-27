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
