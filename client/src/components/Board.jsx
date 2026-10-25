import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { socket } from '../socket';

export default function Board({ boardId, tool, color }) {
  const [strokes, setStrokes] = useState([]);
  const drawing = useRef(null);

  useEffect(() => {
    socket.connect();
    socket.emit('board:join', boardId);
    socket.on('board:snapshot', (snap) => setStrokes(snap.strokes));
    socket.on('stroke:add', (stroke) => setStrokes((s) => [...s, stroke]));
    return () => {
      socket.off('board:snapshot');
      socket.off('stroke:add');
      socket.disconnect();
    };
  }, [boardId]);

  const handleMouseDown = (e) => {
    const { x, y } = e.target.getStage().getPointerPosition();
    drawing.current = { id: crypto.randomUUID(), tool, color, points: [x, y] };
    setStrokes((s) => [...s, drawing.current]);
  };

  const handleMouseMove = (e) => {
    if (!drawing.current) return;
    const { x, y } = e.target.getStage().getPointerPosition();
    drawing.current = { ...drawing.current, points: [...drawing.current.points, x, y] };
    const current = drawing.current;
    setStrokes((s) => [...s.slice(0, -1), current]);
  };

  const handleMouseUp = () => {
    if (!drawing.current) return;
    // Send the finished stroke once; live per-point streaming + throttling comes later.
    socket.emit('stroke:add', drawing.current);
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
    </Stage>
  );
}
