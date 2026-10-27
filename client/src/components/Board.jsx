import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { socket } from '../socket';
import { me } from '../identity';
import { throttle } from '../utils/throttle';
import { createBatcher } from '../utils/batcher';
import Cursors from './Cursors';

const CURSOR_THROTTLE_MS = 50;
const STROKE_BATCH_MS = 40;

export default function Board({ boardId, tool, color }) {
  const [strokes, setStrokes] = useState([]);
  const [cursors, setCursors] = useState({});
  const drawing = useRef(null);

  const sendCursor = useMemo(
    () => throttle((x, y) => socket.emit('cursor:move', { x, y, ...me }), CURSOR_THROTTLE_MS),
    []
  );

  // Points drawn since the last flush, sent together for the current stroke.
  const pointBatcher = useMemo(
    () =>
      createBatcher((points) => {
        if (drawing.current) socket.emit('stroke:points', { id: drawing.current.id, points });
      }, STROKE_BATCH_MS),
    []
  );

  useEffect(() => {
    socket.connect();
    socket.emit('board:join', boardId);
    socket.on('board:snapshot', (snap) => setStrokes(snap.strokes));
    socket.on('stroke:start', (stroke) => setStrokes((s) => [...s, stroke]));
    socket.on('stroke:points', ({ id, points }) =>
      setStrokes((s) => s.map((st) => (st.id === id ? { ...st, points: [...st.points, ...points] } : st)))
    );
    socket.on('cursor:move', (c) => setCursors((cs) => ({ ...cs, [c.id]: c })));
    socket.on('cursor:leave', (id) =>
      setCursors(({ [id]: _gone, ...rest }) => rest)
    );
    return () => {
      sendCursor.cancel();
      pointBatcher.cancel();
      socket.off('board:snapshot');
      socket.off('stroke:start');
      socket.off('stroke:points');
      socket.off('cursor:move');
      socket.off('cursor:leave');
      socket.disconnect();
    };
  }, [boardId, sendCursor, pointBatcher]);

  const handleMouseDown = (e) => {
    const { x, y } = e.target.getStage().getPointerPosition();
    drawing.current = { id: crypto.randomUUID(), tool, color, points: [x, y] };
    socket.emit('stroke:start', drawing.current);
    setStrokes((s) => [...s, drawing.current]);
  };

  const handleMouseMove = (e) => {
    const { x, y } = e.target.getStage().getPointerPosition();
    sendCursor(x, y);
    if (!drawing.current) return;
    drawing.current = { ...drawing.current, points: [...drawing.current.points, x, y] };
    pointBatcher.push(x, y);
    const current = drawing.current;
    setStrokes((s) => s.map((st) => (st.id === current.id ? current : st)));
  };

  const handleMouseUp = () => {
    if (!drawing.current) return;
    pointBatcher.flush();
    drawing.current = null;
  };

  return (
    <Stage
      width={window.innerWidth}
      height={window.innerHeight}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <Layer>
        {strokes.map((s) => (
          <Line
            key={s.id}
            points={s.points}
            stroke={s.color}
            strokeWidth={s.tool === 'eraser' ? 20 : 3}
            lineCap="round"
            lineJoin="round"
            tension={0.5}
            globalCompositeOperation={s.tool === 'eraser' ? 'destination-out' : 'source-over'}
          />
        ))}
      </Layer>
      <Layer listening={false}>
        <Cursors cursors={cursors} />
      </Layer>
    </Stage>
  );
}
