import { render, screen, act } from '@testing-library/react';
import { useWindowSize } from '../hooks/useWindowSize';

function Probe() {
  const { width, height } = useWindowSize();
  return <span>{`${width}x${height}`}</span>;
}

test('updates when the window is resized', () => {
  window.innerWidth = 800;
  window.innerHeight = 600;
  render(<Probe />);
  expect(screen.getByText('800x600')).toBeInTheDocument();

  act(() => {
    window.innerWidth = 1280;
    window.innerHeight = 720;
    window.dispatchEvent(new Event('resize'));
  });
  expect(screen.getByText('1280x720')).toBeInTheDocument();
});
