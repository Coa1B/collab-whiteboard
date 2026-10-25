import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '../components/Toolbar';

test('marks the active tool and reports tool changes', () => {
  const onToolChange = jest.fn();
  render(<Toolbar tool="pen" color="#000000" onToolChange={onToolChange} onColorChange={() => {}} />);

  expect(screen.getByRole('button', { name: 'pen' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'eraser' }));
  expect(onToolChange).toHaveBeenCalledWith('eraser');
});
