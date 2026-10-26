import { Group, Circle, Text } from 'react-konva';

export default function Cursors({ cursors }) {
  return Object.entries(cursors).map(([id, c]) => (
    <Group key={id} x={c.x} y={c.y} listening={false}>
      <Circle radius={5} fill={c.color} />
      <Text text={c.name} x={8} y={-6} fontSize={12} fill={c.color} />
    </Group>
  ));
}
